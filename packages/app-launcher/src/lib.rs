//! Non-visual package launcher core.
//!
//! Reads `package-launcher.json`, resolves config-relative paths, starts the
//! Web Console hidden with stdout/stderr redirected, polls its health endpoint
//! within a bounded budget, then starts the Tauri shell forwarding
//! `--web-console-pid=<pid>`. Startup outcomes are persisted to
//! `package-selfcheck-last.json` and failures are surfaced via [`LaunchError`].
//!
//! The process-spawning and time/sleep collaborators are injectable through
//! [`LaunchSpawner`] and the closures passed to [`launch`], so the full bring-up
//! sequence is unit-testable without spawning real processes.

use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde_json::{json, Value};

/// Outcome of a single health probe.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProbeOutcome {
    /// Endpoint responded healthy; stop polling.
    Ready,
    /// Endpoint responded but not healthy yet; keep polling.
    NotReady,
    /// Probe failed transiently (e.g. connection refused); keep polling.
    Transient,
}

/// Errors surfaced when the launcher cannot bring the package online.
#[derive(Debug)]
pub enum LaunchError {
    /// `package-launcher.json` could not be read or parsed.
    ConfigInvalid(String),
    /// A configured executable path does not exist on disk.
    ExecutableMissing { role: &'static str, path: PathBuf },
    /// The Web Console process could not be spawned.
    WebConsoleSpawn(std::io::Error),
    /// The health endpoint did not become ready within the configured budget.
    HealthTimeout { url: String, waited_secs: u64 },
    /// The Tauri shell process could not be spawned.
    TauriSpawn(std::io::Error),
    /// The log directory or self-check file could not be written.
    Persistence(std::io::Error),
}

impl std::fmt::Display for LaunchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ConfigInvalid(msg) => {
                write!(f, "package-launcher config invalid: {msg}")
            }
            Self::ExecutableMissing { role, path } => {
                write!(f, "{role} executable not found at {}", path.display())
            }
            Self::WebConsoleSpawn(e) => write!(f, "failed to spawn web console: {e}"),
            Self::HealthTimeout { url, waited_secs } => write!(
                f,
                "web console health check timed out after {waited_secs}s at {url}"
            ),
            Self::TauriSpawn(e) => write!(f, "failed to spawn tauri shell: {e}"),
            Self::Persistence(e) => write!(f, "failed to persist launcher self-check: {e}"),
        }
    }
}

impl std::error::Error for LaunchError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::WebConsoleSpawn(e) | Self::TauriSpawn(e) | Self::Persistence(e) => Some(e),
            _ => None,
        }
    }
}

/// One executable entry (path + extra args) from the launcher config.
#[derive(Debug, Clone)]
pub struct ExecutableSpec {
    /// Resolved (config-relative) path to the executable.
    pub path: PathBuf,
    /// Extra command-line arguments forwarded verbatim.
    pub args: Vec<String>,
}

/// Fully resolved launcher configuration.
#[derive(Debug, Clone)]
pub struct LauncherConfig {
    pub web_console: ExecutableSpec,
    pub tauri: ExecutableSpec,
    pub health_url: String,
    pub health_timeout: Duration,
    pub health_poll_interval: Duration,
    pub log_dir: PathBuf,
    /// Always `<log_dir>/package-selfcheck-last.json`.
    pub selfcheck_file: PathBuf,
}

impl LauncherConfig {
    /// Parse from raw JSON text, resolving relative paths against `config_dir`
    /// (the directory that contains `package-launcher.json`).
    pub fn from_json(text: &str, config_dir: &Path) -> Result<Self, LaunchError> {
        let value: Value = serde_json::from_str(text)
            .map_err(|e| LaunchError::ConfigInvalid(format!("invalid JSON: {e}")))?;

        let web_console = Self::parse_executable(&value, "web_console", config_dir)?;
        let tauri = Self::parse_executable(&value, "tauri", config_dir)?;
        let health_url = value
            .get("health_url")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .ok_or_else(|| LaunchError::ConfigInvalid("missing health_url".into()))?;
        let health_timeout_secs = value
            .get("health_timeout_secs")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| LaunchError::ConfigInvalid("missing health_timeout_secs".into()))?;
        let health_poll_interval_ms = value
            .get("health_poll_interval_ms")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| LaunchError::ConfigInvalid("missing health_poll_interval_ms".into()))?;
        let log_dir = Self::parse_path(&value, "log_dir", config_dir)?;
        let selfcheck_file = log_dir.join("package-selfcheck-last.json");

        Ok(Self {
            web_console,
            tauri,
            health_url,
            health_timeout: Duration::from_secs(health_timeout_secs),
            health_poll_interval: Duration::from_millis(health_poll_interval_ms),
            log_dir,
            selfcheck_file,
        })
    }

    fn parse_executable(
        value: &Value,
        role: &'static str,
        config_dir: &Path,
    ) -> Result<ExecutableSpec, LaunchError> {
        let entry = value
            .get(role)
            .ok_or_else(|| LaunchError::ConfigInvalid(format!("missing {role} section")))?;
        let exec_str = entry
            .get("executable")
            .and_then(|v| v.as_str())
            .ok_or_else(|| LaunchError::ConfigInvalid(format!("missing {role}.executable")))?;
        let path = resolve_config_relative(Path::new(exec_str), config_dir);
        let args = entry
            .get("args")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();
        Ok(ExecutableSpec { path, args })
    }

    fn parse_path(value: &Value, key: &str, config_dir: &Path) -> Result<PathBuf, LaunchError> {
        let s = value
            .get(key)
            .and_then(|v| v.as_str())
            .ok_or_else(|| LaunchError::ConfigInvalid(format!("missing {key}")))?;
        Ok(resolve_config_relative(Path::new(s), config_dir))
    }
}

/// Resolve a path from the launcher config.
///
/// Relative paths are interpreted against `config_dir` (the directory that
/// holds `package-launcher.json`); absolute paths are kept unchanged.
pub fn resolve_config_relative(path: &Path, config_dir: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        config_dir.join(path)
    }
}

/// Poll `probe` until it reports [`ProbeOutcome::Ready`] or `timeout` is
/// consumed (measured via `now_fn`, sleeping `poll_interval` between probes via
/// `sleep_fn`).
///
/// `now_fn` / `sleep_fn` are injected so the bounded budget can be exercised
/// deterministically in tests without real sleeping; the real entrypoint wires
/// them to `Instant::now`-based elapsed and `std::thread::sleep`.
pub fn poll_health<N, S>(
    health_url: &str,
    timeout: Duration,
    poll_interval: Duration,
    probe: &mut dyn FnMut() -> ProbeOutcome,
    mut now_fn: N,
    mut sleep_fn: S,
) -> Result<(), LaunchError>
where
    N: FnMut() -> Duration,
    S: FnMut(Duration),
{
    let start = now_fn();
    loop {
        match probe() {
            ProbeOutcome::Ready => return Ok(()),
            ProbeOutcome::NotReady | ProbeOutcome::Transient => {}
        }
        sleep_fn(poll_interval);
        if now_fn().saturating_sub(start) >= timeout {
            return Err(LaunchError::HealthTimeout {
                url: health_url.to_string(),
                waited_secs: timeout.as_secs(),
            });
        }
    }
}

/// Build the argument vector forwarded to the Tauri shell, injecting
/// `--web-console-pid=<pid>` ahead of any configured extra args.
pub fn build_tauri_args(web_console_pid: u32, extra_args: &[String]) -> Vec<String> {
    let mut args = Vec::with_capacity(extra_args.len() + 1);
    args.push(format!("--web-console-pid={web_console_pid}"));
    args.extend(extra_args.iter().cloned());
    args
}

/// Self-check record persisted after each launch attempt.
#[derive(Debug, Clone)]
pub struct SelfcheckPayload {
    pub ok: bool,
    pub web_console_pid: Option<u32>,
    pub tauri_pid: Option<u32>,
    pub health_url: String,
    pub error: Option<String>,
    pub timestamp_ms: u64,
}

/// Write the self-check JSON file atomically, creating `log_dir` first.
pub fn write_selfcheck(
    selfcheck_file: &Path,
    log_dir: &Path,
    payload: &SelfcheckPayload,
) -> Result<(), LaunchError> {
    fs::create_dir_all(log_dir).map_err(LaunchError::Persistence)?;
    let body = json!({
        "ok": payload.ok,
        "web_console_pid": payload.web_console_pid,
        "tauri_pid": payload.tauri_pid,
        "health_url": payload.health_url,
        "error": payload.error,
        "timestamp_ms": payload.timestamp_ms,
    });
    let mut tmp = selfcheck_file.to_path_buf();
    tmp.set_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(LaunchError::Persistence)?;
        f.write_all(body.to_string().as_bytes())
            .map_err(LaunchError::Persistence)?;
        f.sync_all().map_err(LaunchError::Persistence)?;
    }
    fs::rename(&tmp, selfcheck_file).map_err(LaunchError::Persistence)?;
    Ok(())
}

/// Abstraction over spawning the Web Console and Tauri shell processes.
///
/// Implementations: a real one backed by `std::process::Command` (in the
/// binary) and fakes in tests.
pub trait LaunchSpawner {
    /// Spawn the Web Console hidden with stdout/stderr redirected to `log_file`.
    /// Returns the spawned child PID.
    fn spawn_web_console(
        &mut self,
        spec: &ExecutableSpec,
        log_file: &Path,
    ) -> Result<u32, LaunchError>;
    /// Spawn the Tauri shell with the given (already pid-injected) args.
    /// Returns the spawned child PID.
    fn spawn_tauri(&mut self, spec: &ExecutableSpec, args: &[String]) -> Result<u32, LaunchError>;
}

/// Result of a successful bring-up.
#[derive(Debug, Clone, Copy)]
pub struct LaunchOutcome {
    pub web_console_pid: u32,
    pub tauri_pid: u32,
}

/// Run the full bring-up sequence using injected collaborators.
///
/// Verifies both executables exist, spawns the Web Console (hidden, stdio
/// redirected), polls health within the configured budget, spawns the Tauri
/// shell with `--web-console-pid=<pid>`, and persists a self-check record. On
/// any failure a failed self-check is still written when possible and the error
/// is surfaced.
#[allow(clippy::too_many_arguments)]
pub fn launch<L, N, S>(
    config: &LauncherConfig,
    spawner: &mut L,
    probe: &mut dyn FnMut() -> ProbeOutcome,
    now_fn: N,
    sleep_fn: S,
    timestamp_ms: u64,
) -> Result<LaunchOutcome, LaunchError>
where
    L: LaunchSpawner,
    N: FnMut() -> Duration,
    S: FnMut(Duration),
{
    if !config.web_console.path.exists() {
        return Err(LaunchError::ExecutableMissing {
            role: "web_console",
            path: config.web_console.path.clone(),
        });
    }
    if !config.tauri.path.exists() {
        return Err(LaunchError::ExecutableMissing {
            role: "tauri",
            path: config.tauri.path.clone(),
        });
    }

    fs::create_dir_all(&config.log_dir).map_err(LaunchError::Persistence)?;
    let log_file = config.log_dir.join("web-console.stdout.log");

    let web_pid = spawner.spawn_web_console(&config.web_console, &log_file)?;

    if let Err(e) = poll_health(
        &config.health_url,
        config.health_timeout,
        config.health_poll_interval,
        probe,
        now_fn,
        sleep_fn,
    ) {
        let payload = SelfcheckPayload {
            ok: false,
            web_console_pid: Some(web_pid),
            tauri_pid: None,
            health_url: config.health_url.clone(),
            error: Some(e.to_string()),
            timestamp_ms,
        };
        let _ = write_selfcheck(&config.selfcheck_file, &config.log_dir, &payload);
        return Err(e);
    }

    let tauri_args = build_tauri_args(web_pid, &config.tauri.args);
    let tauri_pid = match spawner.spawn_tauri(&config.tauri, &tauri_args) {
        Ok(pid) => pid,
        Err(e) => {
            let payload = SelfcheckPayload {
                ok: false,
                web_console_pid: Some(web_pid),
                tauri_pid: None,
                health_url: config.health_url.clone(),
                error: Some(e.to_string()),
                timestamp_ms,
            };
            let _ = write_selfcheck(&config.selfcheck_file, &config.log_dir, &payload);
            return Err(e);
        }
    };

    let payload = SelfcheckPayload {
        ok: true,
        web_console_pid: Some(web_pid),
        tauri_pid: Some(tauri_pid),
        health_url: config.health_url.clone(),
        error: None,
        timestamp_ms,
    };
    write_selfcheck(&config.selfcheck_file, &config.log_dir, &payload)?;

    Ok(LaunchOutcome {
        web_console_pid: web_pid,
        tauri_pid,
    })
}

/// Best-effort real HTTP health probe over a raw `TcpStream`.
///
/// Not unit-tested (it touches the network); used by the binary entrypoint.
pub fn http_probe(url: &str) -> ProbeOutcome {
    let Some((host, port, path)) = parse_http_url(url) else {
        return ProbeOutcome::Transient;
    };
    let addr_str = format!("{host}:{port}");
    let Ok(addr) = addr_str.parse::<SocketAddr>() else {
        return ProbeOutcome::Transient;
    };
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_secs(2)) else {
        return ProbeOutcome::Transient;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let req = format!("GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n");
    if stream.write_all(req.as_bytes()).is_err() {
        return ProbeOutcome::Transient;
    }
    let mut buf = [0u8; 256];
    let n = match stream.read(&mut buf) {
        Ok(0) => return ProbeOutcome::NotReady,
        Ok(n) => n,
        Err(_) => return ProbeOutcome::Transient,
    };
    let head = std::str::from_utf8(&buf[..n]).unwrap_or("");
    if head.contains(" 200 ") || head.contains(" 200\r") {
        ProbeOutcome::Ready
    } else {
        ProbeOutcome::NotReady
    }
}

/// Parse an `http://host:port/path` URL into its parts.
fn parse_http_url(url: &str) -> Option<(String, u16, String)> {
    let rest = url.strip_prefix("http://")?;
    let (authority, path) = match rest.find('/') {
        Some(i) => (&rest[..i], &rest[i..]),
        None => (rest, "/"),
    };
    let (host, port) = match authority.rsplit_once(':') {
        Some((h, p)) => (h.to_string(), p.parse::<u16>().ok()?),
        None => (authority.to_string(), 80),
    };
    Some((host, port, path.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static SEQ: AtomicU64 = AtomicU64::new(0);

    fn temp_dir_unique(label: &str) -> PathBuf {
        let mut p = std::env::temp_dir();
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let seq = SEQ.fetch_add(1, Ordering::SeqCst);
        p.push(format!("coolzhu-app-launcher-{label}-{nanos}-{seq}"));
        p
    }

    #[test]
    fn resolves_relative_paths_against_config_dir() {
        let tmp = temp_dir_unique("cfg");
        let config_dir = tmp.join("config");
        fs::create_dir_all(&config_dir).unwrap();

        let cfg_text = r#"{
            "web_console": {"executable": "../bin/coolzhu-web-console.exe", "args": ["--headless"]},
            "tauri": {"executable": "../bin/coolzhu-tauri-shell.exe", "args": ["--ui=foo"]},
            "health_url": "http://127.0.0.1:8765/api/diagnostics/health",
            "health_timeout_secs": 12,
            "health_poll_interval_ms": 250,
            "log_dir": "../tmp/logs/package-launcher"
        }"#;
        let cfg = LauncherConfig::from_json(cfg_text, &config_dir).unwrap();

        assert_eq!(
            cfg.web_console.path,
            config_dir.join("../bin/coolzhu-web-console.exe")
        );
        assert_eq!(cfg.web_console.args, vec!["--headless".to_string()]);
        assert_eq!(
            cfg.tauri.path,
            config_dir.join("../bin/coolzhu-tauri-shell.exe")
        );
        assert_eq!(cfg.tauri.args, vec!["--ui=foo".to_string()]);
        assert_eq!(
            cfg.health_url,
            "http://127.0.0.1:8765/api/diagnostics/health"
        );
        assert_eq!(cfg.health_timeout, Duration::from_secs(12));
        assert_eq!(cfg.health_poll_interval, Duration::from_millis(250));
        assert_eq!(cfg.log_dir, config_dir.join("../tmp/logs/package-launcher"));
        assert_eq!(
            cfg.selfcheck_file,
            config_dir
                .join("../tmp/logs/package-launcher")
                .join("package-selfcheck-last.json")
        );
    }

    #[test]
    fn absolute_paths_are_preserved_unchanged() {
        let config_dir = Path::new("C:/repo/config");
        let cfg_text = r#"{
            "web_console": {"executable": "C:/abs/web.exe", "args": []},
            "tauri": {"executable": "C:/abs/tauri.exe", "args": []},
            "health_url": "http://127.0.0.1:1/health",
            "health_timeout_secs": 1,
            "health_poll_interval_ms": 1,
            "log_dir": "C:/abs/logs"
        }"#;
        let cfg = LauncherConfig::from_json(cfg_text, config_dir).unwrap();
        assert_eq!(cfg.web_console.path, PathBuf::from("C:/abs/web.exe"));
        assert_eq!(cfg.tauri.path, PathBuf::from("C:/abs/tauri.exe"));
        assert_eq!(cfg.log_dir, PathBuf::from("C:/abs/logs"));
    }

    #[test]
    fn invalid_json_is_surfaced_as_config_error() {
        let res = LauncherConfig::from_json("{ not json", Path::new("C:/c"));
        assert!(matches!(res, Err(LaunchError::ConfigInvalid(_))));
    }

    #[test]
    fn poll_health_returns_ok_when_probe_reports_ready() {
        let calls = std::cell::Cell::new(0u32);
        let mut probe = || {
            let n = calls.get();
            calls.set(n + 1);
            if n + 1 >= 2 {
                ProbeOutcome::Ready
            } else {
                ProbeOutcome::NotReady
            }
        };
        let clock = std::cell::Cell::new(Duration::ZERO);
        let now = || clock.get();
        let sleep = |d: Duration| clock.set(clock.get() + d);

        let res = poll_health(
            "http://x/health",
            Duration::from_secs(10),
            Duration::from_millis(100),
            &mut probe,
            now,
            sleep,
        );
        assert!(res.is_ok());
        assert_eq!(calls.get(), 2);
    }

    #[test]
    fn poll_health_times_out_within_budget() {
        let mut probe = || ProbeOutcome::NotReady;
        let clock = std::cell::Cell::new(Duration::ZERO);
        let now = || clock.get();
        let sleep = |d: Duration| clock.set(clock.get() + d);

        let res = poll_health(
            "http://x/health",
            Duration::from_millis(500),
            Duration::from_millis(100),
            &mut probe,
            now,
            sleep,
        );
        assert!(matches!(res, Err(LaunchError::HealthTimeout { .. })));
    }

    #[test]
    fn poll_health_surfaces_transient_probes_until_timeout() {
        let mut probe = || ProbeOutcome::Transient;
        let clock = std::cell::Cell::new(Duration::ZERO);
        let res = poll_health(
            "http://x/health",
            Duration::from_millis(50),
            Duration::from_millis(10),
            &mut probe,
            || clock.get(),
            |d: Duration| clock.set(clock.get() + d),
        );
        assert!(matches!(res, Err(LaunchError::HealthTimeout { .. })));
    }

    #[test]
    fn tauri_args_forward_web_console_pid_first() {
        let extra = vec!["--ui=foo".to_string(), "bar".to_string()];
        let args = build_tauri_args(12345, &extra);
        assert_eq!(
            args,
            vec![
                "--web-console-pid=12345".to_string(),
                "--ui=foo".to_string(),
                "bar".to_string()
            ]
        );
    }

    #[test]
    fn tauri_args_with_no_extra_args() {
        let args = build_tauri_args(1, &[]);
        assert_eq!(args, vec!["--web-console-pid=1".to_string()]);
    }

    #[test]
    fn writes_selfcheck_file_with_payload() {
        let tmp = temp_dir_unique("selfcheck");
        let log_dir = tmp.join("logs");
        let selfcheck = log_dir.join("package-selfcheck-last.json");
        let payload = SelfcheckPayload {
            ok: true,
            web_console_pid: Some(42),
            tauri_pid: Some(7),
            health_url: "http://127.0.0.1:1/health".into(),
            error: None,
            timestamp_ms: 1234,
        };
        write_selfcheck(&selfcheck, &log_dir, &payload).unwrap();

        assert!(selfcheck.is_file());
        let text = fs::read_to_string(&selfcheck).unwrap();
        let v: Value = serde_json::from_str(&text).unwrap();
        assert_eq!(v["ok"], true);
        assert_eq!(v["web_console_pid"], 42);
        assert_eq!(v["tauri_pid"], 7);
        assert_eq!(v["health_url"], "http://127.0.0.1:1/health");
        assert_eq!(v["error"], Value::Null);
        assert_eq!(v["timestamp_ms"], 1234);
    }

    #[test]
    fn writes_failed_selfcheck_payload() {
        let tmp = temp_dir_unique("selfcheck-fail");
        let log_dir = tmp.join("logs");
        let selfcheck = log_dir.join("package-selfcheck-last.json");
        let payload = SelfcheckPayload {
            ok: false,
            web_console_pid: Some(42),
            tauri_pid: None,
            health_url: "http://127.0.0.1:1/health".into(),
            error: Some("boom".into()),
            timestamp_ms: 9,
        };
        write_selfcheck(&selfcheck, &log_dir, &payload).unwrap();
        let v: Value = serde_json::from_str(&fs::read_to_string(&selfcheck).unwrap()).unwrap();
        assert_eq!(v["ok"], false);
        assert_eq!(v["tauri_pid"], Value::Null);
        assert_eq!(v["error"], "boom");
    }

    struct FakeSpawner {
        web_pid: u32,
        tauri_pid: u32,
        web_calls: u32,
        tauri_calls: u32,
        last_tauri_args: Vec<String>,
    }

    impl FakeSpawner {
        fn new(web_pid: u32, tauri_pid: u32) -> Self {
            Self {
                web_pid,
                tauri_pid,
                web_calls: 0,
                tauri_calls: 0,
                last_tauri_args: Vec::new(),
            }
        }
    }

    impl LaunchSpawner for FakeSpawner {
        fn spawn_web_console(
            &mut self,
            _spec: &ExecutableSpec,
            _log_file: &Path,
        ) -> Result<u32, LaunchError> {
            self.web_calls += 1;
            Ok(self.web_pid)
        }
        fn spawn_tauri(
            &mut self,
            _spec: &ExecutableSpec,
            args: &[String],
        ) -> Result<u32, LaunchError> {
            self.tauri_calls += 1;
            self.last_tauri_args = args.to_vec();
            Ok(self.tauri_pid)
        }
    }

    fn touch_executable(label: &str) -> PathBuf {
        let tmp = temp_dir_unique(label);
        fs::create_dir_all(&tmp).unwrap();
        let exe = tmp.join("stub.exe");
        fs::write(&exe, b"").unwrap();
        exe
    }

    fn config_with_paths(web: PathBuf, tauri: PathBuf, log_dir: PathBuf) -> LauncherConfig {
        let selfcheck_file = log_dir.join("package-selfcheck-last.json");
        LauncherConfig {
            web_console: ExecutableSpec {
                path: web,
                args: vec![],
            },
            tauri: ExecutableSpec {
                path: tauri,
                args: vec!["--ui=foo".into()],
            },
            health_url: "http://127.0.0.1:1/health".into(),
            health_timeout: Duration::from_millis(100),
            health_poll_interval: Duration::from_millis(10),
            log_dir,
            selfcheck_file,
        }
    }

    #[test]
    fn launch_surfaces_missing_web_console_executable() {
        let tauri = touch_executable("t-exists");
        let log_dir = temp_dir_unique("log-missing-web");
        let cfg = config_with_paths(
            temp_dir_unique("no-web").join("missing.exe"),
            tauri,
            log_dir,
        );
        let mut spawner = FakeSpawner::new(11, 22);
        let mut probe = || ProbeOutcome::Ready;
        let res = launch(&cfg, &mut spawner, &mut probe, || Duration::ZERO, |_| {}, 0);
        assert!(matches!(
            res,
            Err(LaunchError::ExecutableMissing {
                role: "web_console",
                ..
            })
        ));
        assert_eq!(spawner.web_calls, 0);
        assert_eq!(spawner.tauri_calls, 0);
    }

    #[test]
    fn launch_surfaces_missing_tauri_executable() {
        let web = touch_executable("w-exists");
        let log_dir = temp_dir_unique("log-missing-tauri");
        let cfg = config_with_paths(
            web,
            temp_dir_unique("no-tauri").join("missing.exe"),
            log_dir,
        );
        let mut spawner = FakeSpawner::new(11, 22);
        let mut probe = || ProbeOutcome::Ready;
        let res = launch(&cfg, &mut spawner, &mut probe, || Duration::ZERO, |_| {}, 0);
        assert!(matches!(
            res,
            Err(LaunchError::ExecutableMissing { role: "tauri", .. })
        ));
    }

    #[test]
    fn launch_happy_path_spawns_both_and_writes_ok_selfcheck() {
        let web = touch_executable("web-ok");
        let tauri = touch_executable("tauri-ok");
        let log_dir = temp_dir_unique("log-ok");
        let cfg = config_with_paths(web, tauri, log_dir.clone());
        let mut spawner = FakeSpawner::new(111, 222);

        let probes = std::cell::Cell::new(0u32);
        let mut probe = || {
            let n = probes.get();
            probes.set(n + 1);
            if n + 1 >= 2 {
                ProbeOutcome::Ready
            } else {
                ProbeOutcome::Transient
            }
        };
        let clock = std::cell::Cell::new(Duration::ZERO);
        let res = launch(
            &cfg,
            &mut spawner,
            &mut probe,
            || clock.get(),
            |d: Duration| clock.set(clock.get() + d),
            999,
        );

        let outcome = res.expect("launch should succeed");
        assert_eq!(outcome.web_console_pid, 111);
        assert_eq!(outcome.tauri_pid, 222);
        assert_eq!(spawner.web_calls, 1);
        assert_eq!(spawner.tauri_calls, 1);
        assert_eq!(
            spawner.last_tauri_args,
            vec!["--web-console-pid=111".to_string(), "--ui=foo".to_string()]
        );

        let v: Value =
            serde_json::from_str(&fs::read_to_string(&cfg.selfcheck_file).unwrap()).unwrap();
        assert_eq!(v["ok"], true);
        assert_eq!(v["web_console_pid"], 111);
        assert_eq!(v["tauri_pid"], 222);
        assert_eq!(v["timestamp_ms"], 999);
    }

    #[test]
    fn launch_writes_failed_selfcheck_on_health_timeout() {
        let web = touch_executable("web-timeout");
        let tauri = touch_executable("tauri-timeout");
        let log_dir = temp_dir_unique("log-timeout");
        let cfg = config_with_paths(web, tauri, log_dir.clone());
        let mut spawner = FakeSpawner::new(555, 666);

        let clock = std::cell::Cell::new(Duration::ZERO);
        let mut probe = || ProbeOutcome::NotReady;
        let res = launch(
            &cfg,
            &mut spawner,
            &mut probe,
            || clock.get(),
            |d: Duration| clock.set(clock.get() + d),
            7,
        );

        assert!(matches!(res, Err(LaunchError::HealthTimeout { .. })));
        assert_eq!(spawner.web_calls, 1);
        assert_eq!(spawner.tauri_calls, 0);

        let v: Value =
            serde_json::from_str(&fs::read_to_string(&cfg.selfcheck_file).unwrap()).unwrap();
        assert_eq!(v["ok"], false);
        assert_eq!(v["web_console_pid"], 555);
        assert_eq!(v["tauri_pid"], Value::Null);
        assert!(v["error"].as_str().unwrap().contains("timed out"));
        assert_eq!(v["timestamp_ms"], 7);
    }

    #[test]
    fn parse_http_url_extracts_host_port_path() {
        let (h, p, path) = parse_http_url("http://127.0.0.1:7860/api/diagnostics/health").unwrap();
        assert_eq!(h, "127.0.0.1");
        assert_eq!(p, 7860);
        assert_eq!(path, "/api/diagnostics/health");
    }

    #[test]
    fn parse_http_url_defaults_port_and_path() {
        let (h, p, path) = parse_http_url("http://localhost").unwrap();
        assert_eq!(h, "localhost");
        assert_eq!(p, 80);
        assert_eq!(path, "/");
    }

    #[test]
    fn parse_http_url_rejects_non_http() {
        assert!(parse_http_url("https://x").is_none());
        assert!(parse_http_url("not a url").is_none());
    }
}
