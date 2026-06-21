//! Binary entrypoint for the non-visual package launcher.
//!
//! Wires the [`app_launcher`] library to real OS collaborators: a
//! [`RealSpawner`] backed by `std::process::Command`, the in-process
//! [`app_launcher::http_probe`], and `Instant`/`thread::sleep` for the
//! bounded health-poll budget. The Web Console is spawned hidden
//! (`CREATE_NO_WINDOW` on Windows) with stdout/stderr redirected to the log
//! file; the Tauri shell is spawned with `--web-console-pid=<pid>`.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use app_launcher::{
    self, http_probe, launch, ExecutableSpec, LaunchError, LaunchSpawner, LauncherConfig,
};

const DEFAULT_CONFIG_PATH: &str = "config/package-launcher.json";

fn main() -> ExitCode {
    let config_path = env::args()
        .nth(1)
        .unwrap_or_else(|| DEFAULT_CONFIG_PATH.to_string());

    match run(&config_path) {
        Ok(outcome) => {
            eprintln!(
                "package-launcher: web-console pid={} tauri pid={}",
                outcome.web_console_pid, outcome.tauri_pid
            );
            ExitCode::SUCCESS
        }
        Err(err) => {
            eprintln!("package-launcher: startup failed: {err}");
            ExitCode::FAILURE
        }
    }
}

fn run(config_path: &str) -> Result<app_launcher::LaunchOutcome, LaunchError> {
    let config_path = Path::new(config_path);
    let config_dir = config_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let text = fs::read_to_string(config_path).map_err(|e| {
        LaunchError::ConfigInvalid(format!("could not read {}: {e}", config_path.display()))
    })?;
    let config = LauncherConfig::from_json(&text, &config_dir)?;

    let start = Instant::now();
    let now_fn = move || start.elapsed();
    let sleep_fn = |d: Duration| std::thread::sleep(d);
    let timestamp_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let mut spawner = RealSpawner;
    let health_url = config.health_url.clone();
    let mut probe = || http_probe(&health_url);
    launch(
        &config,
        &mut spawner,
        &mut probe,
        now_fn,
        sleep_fn,
        timestamp_ms,
    )
}

/// Real process spawner backed by `std::process::Command`.
struct RealSpawner;

impl LaunchSpawner for RealSpawner {
    fn spawn_web_console(
        &mut self,
        spec: &ExecutableSpec,
        log_file: &Path,
    ) -> Result<u32, LaunchError> {
        let log = fs::File::create(log_file).map_err(LaunchError::WebConsoleSpawn)?;
        let stderr = log
            .try_clone()
            .map_err(LaunchError::WebConsoleSpawn)
            .map(Stdio::from)?;
        let stdout = Stdio::from(log);

        let mut cmd = Command::new(&spec.path);
        cmd.args(&spec.args)
            .stdin(Stdio::null())
            .stdout(stdout)
            .stderr(stderr);

        apply_hidden_window(&mut cmd);

        let child = cmd.spawn().map_err(LaunchError::WebConsoleSpawn)?;
        Ok(child.id())
    }

    fn spawn_tauri(&mut self, spec: &ExecutableSpec, args: &[String]) -> Result<u32, LaunchError> {
        let mut cmd = Command::new(&spec.path);
        cmd.args(args).stdin(Stdio::null());
        let child = cmd.spawn().map_err(LaunchError::TauriSpawn)?;
        Ok(child.id())
    }
}

/// Hide the spawned process window on Windows (Web Console runs headless).
#[cfg(windows)]
fn apply_hidden_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    // CREATE_NO_WINDOW = 0x0800_0000
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn apply_hidden_window(_cmd: &mut Command) {}
