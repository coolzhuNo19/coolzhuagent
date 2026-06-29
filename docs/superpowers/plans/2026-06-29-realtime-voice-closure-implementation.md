# Realtime Voice Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add BaiLongMa-inspired streaming audio data-plane capabilities to Coolzhu while preserving the existing turn generation, readiness gate, downgrade, and audit semantics, then prove a physical microphone to speaker loop.

**Architecture:** A browser AudioWorklet sends 16 kHz mono PCM frames over a local WebSocket to a Rust streaming STT adapter. Partial/final transcripts enter the existing RealtimeTurnController; model deltas feed the existing TTS stream, with explicit output routing, two-stage barge-in, reconnect buffering, and current-session readiness evidence.

**Tech Stack:** Browser AudioWorklet/Web Audio/WebSocket, JavaScript, Rust 2021, Axum WebSocket, Tokio, tokio-tungstenite, serde, existing LLM/TTS session runtime, Windows audio endpoints.

---

## File structure

- Create modules/gui-web/packages/web-console/src/realtime_voice_stream.rs: PCM protocol, STT provider contract, Aliyun Paraformer adapter, stream session state, reconnect and telemetry.
- Create modules/gui-web/packages/web-console/src/realtime_voice_capture.js: browser AudioWorklet capture, frame sequence, reconnect buffer, diagnostics, physical device selection.
- Create modules/gui-web/packages/web-console/src/realtime_audio_output.js: output device routing and two-stage duck/barge-in controller.
- Create modules/gui-web/packages/web-console/tools/realtime_voice_capture_contract.test.mjs: pure JavaScript contract tests.
- Create modules/gui-web/packages/web-console/tools/realtime_physical_mic_e2e.js: evidence collector for the operator-assisted physical-device test.
- Modify modules/gui-web/packages/web-console/index.html: load the two focused browser modules before app.js.
- Modify modules/gui-web/packages/web-console/src/app.js: connect the new modules to RealtimeTurnController and remove full-stream dependence on MediaRecorder/SpeechRecognition.
- Modify modules/gui-web/packages/web-console/src/main.rs: configuration, routes, state events, readiness evidence, and fallback wiring.
- Modify modules/gui-web/packages/web-console/Cargo.toml: WebSocket dependencies.
- Modify modules/gui-web/packages/web-console/README.md: truthful physical-microphone test instructions.
- Modify config/package-manifest.json and scripts/test-package-safety.ps1: package browser assets while excluding credentials and runtime recordings.

### Task 1: Create a rollback snapshot and establish the failing baseline

**Files:**
- Read: modules/gui-web/packages/web-console/src/app.js
- Read: modules/gui-web/packages/web-console/src/main.rs
- Read: config/package-manifest.json
- Create outside source tree: a timestamped `C:\Users\zhupu\Desktop\coolzhu-agent-project\backups\pre-realtime-voice-*` directory

- [ ] **Step 1: Copy the risky source scope before editing**

Run:

~~~powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $env:USERPROFILE "Desktop\coolzhu-agent-project\backups\pre-realtime-voice-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Copy-Item -Recurse -LiteralPath "modules/gui-web/packages/web-console" -Destination $backup
Copy-Item -LiteralPath "config/package-manifest.json" -Destination $backup
Set-Content -LiteralPath (Join-Path $backup "git-head.txt") -Value (git rev-parse HEAD)
Write-Output $backup
~~~

Expected: a new backup directory containing web-console, package-manifest.json, and git-head.txt.

- [ ] **Step 2: Run the current focused baseline**

Run:

~~~powershell
cargo test -p coolzhu-web-console realtime_full_stream --offline
node modules/gui-web/packages/web-console/tools/realtime_real_speech_e2e.js --help
~~~

Expected: current Rust tests pass; the existing script describes synthesized TTS-to-STT input and does not prove a physical microphone.

- [ ] **Step 3: Commit no files**

Record the backup path in the execution log. Do not stage unrelated dirty files.

### Task 2: Define streaming STT configuration and protocol

**Files:**
- Create: modules/gui-web/packages/web-console/src/realtime_voice_stream.rs
- Modify: modules/gui-web/packages/web-console/src/main.rs:1-5, ConfigAudioRealtime, realtime routes
- Modify: modules/gui-web/packages/web-console/Cargo.toml

- [ ] **Step 1: Write failing Rust protocol tests**

Add tests in realtime_voice_stream.rs:

~~~rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_monotonic_pcm_sequence() {
        let mut guard = FrameSequenceGuard::default();
        assert!(guard.accept(1).is_ok());
        let error = guard.accept(1).unwrap_err();
        assert_eq!(error.code, "duplicate_pcm_frame");
    }

    #[test]
    fn provider_native_gate_requires_audio_and_transcript_evidence() {
        let evidence = StreamingSttEvidence {
            pcm_frames_sent: 4,
            partial_events: 0,
            final_events: 0,
            ..StreamingSttEvidence::default()
        };
        assert!(!evidence.provider_native_ready());
        let ready = StreamingSttEvidence { partial_events: 1, ..evidence };
        assert!(ready.provider_native_ready());
    }
}
~~~

- [ ] **Step 2: Verify the test fails**

Run:

~~~powershell
cargo test -p coolzhu-web-console realtime_voice_stream --offline
~~~

Expected: FAIL because the module and types do not exist.

- [ ] **Step 3: Implement the protocol and provider-neutral session contract**

Create these public boundaries in realtime_voice_stream.rs:

~~~rust
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub(crate) struct PcmFrame {
    pub session_id: String,
    pub sequence: u64,
    pub captured_at_ms: u64,
    pub sample_rate_hz: u32,
    pub channels: u8,
    pub samples: Vec<i16>,
}

#[derive(Debug, Clone, Default, serde::Serialize)]
pub(crate) struct StreamingSttEvidence {
    pub pcm_frames_sent: u64,
    pub pcm_bytes_sent: u64,
    pub partial_events: u64,
    pub final_events: u64,
    pub reconnects: u64,
    pub dropped_frames: u64,
    pub max_frame_gap_ms: u64,
}

impl StreamingSttEvidence {
    pub(crate) fn provider_native_ready(&self) -> bool {
        self.pcm_frames_sent > 0 && (self.partial_events > 0 || self.final_events > 0)
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub(crate) struct StreamError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

#[derive(Default)]
pub(crate) struct FrameSequenceGuard {
    last: Option<u64>,
}

impl FrameSequenceGuard {
    pub(crate) fn accept(&mut self, sequence: u64) -> Result<(), StreamError> {
        if self.last.is_some_and(|last| sequence <= last) {
            return Err(StreamError {
                code: "duplicate_pcm_frame".into(),
                message: "PCM sequence did not advance".into(),
                retryable: false,
            });
        }
        self.last = Some(sequence);
        Ok(())
    }
}
~~~

Add ConfigAudioRealtime fields with serde defaults:

~~~rust
#[serde(default)]
stt_provider: String,
#[serde(default)]
stt_websocket_url: Option<String>,
#[serde(default)]
stt_api_key: Option<String>,
#[serde(default = "default_audio_pcm_frame_ms")]
pcm_frame_ms: u32,
#[serde(default = "default_audio_reconnect_buffer_ms")]
reconnect_buffer_ms: u32,
~~~

Use defaults of 20 ms and 8000 ms. Do not log or serialize stt_api_key in status responses.

- [ ] **Step 4: Enable Axum and cloud client WebSockets**

Change Cargo.toml dependencies to:

~~~toml
axum = { version = "0.8", features = ["multipart", "ws"] }
futures-util = "0.3"
tokio-tungstenite = { version = "0.26", features = ["rustls-tls-webpki-roots"] }
~~~

- [ ] **Step 5: Run tests**

Run:

~~~powershell
cargo test -p coolzhu-web-console realtime_voice_stream --offline
~~~

Expected: PASS for sequence rejection and readiness evidence.

- [ ] **Step 6: Commit**

~~~powershell
git add modules/gui-web/packages/web-console/src/realtime_voice_stream.rs modules/gui-web/packages/web-console/src/main.rs modules/gui-web/packages/web-console/Cargo.toml
git commit -m "feat: define realtime PCM streaming protocol"
~~~

### Task 3: Add AudioWorklet physical microphone capture

**Files:**
- Create: modules/gui-web/packages/web-console/src/realtime_voice_capture.js
- Create: modules/gui-web/packages/web-console/tools/realtime_voice_capture_contract.test.mjs
- Modify: modules/gui-web/packages/web-console/index.html:9
- Modify: modules/gui-web/packages/web-console/src/app.js:12578-13127, 13665-13830

- [ ] **Step 1: Write failing JavaScript contract tests**

~~~javascript
import assert from "node:assert/strict";
await import("../src/realtime_voice_capture.js");

const api = globalThis.CoolzhuRealtimeVoiceCapture;
assert.equal(api.frameSamples(16000, 20), 320);
const ring = new api.FrameRingBuffer(3);
ring.push({ sequence: 1 });
ring.push({ sequence: 2 });
ring.push({ sequence: 3 });
ring.push({ sequence: 4 });
assert.deepEqual(ring.drain().map((frame) => frame.sequence), [2, 3, 4]);
console.log("realtime voice capture contracts: PASS");
~~~

- [ ] **Step 2: Verify the test fails**

Run:

~~~powershell
node modules/gui-web/packages/web-console/tools/realtime_voice_capture_contract.test.mjs
~~~

Expected: FAIL because CoolzhuRealtimeVoiceCapture is undefined.

- [ ] **Step 3: Implement the focused capture module**

The module must expose:

~~~javascript
(() => {
  const frameSamples = (sampleRate, frameMs) =>
    Math.max(1, Math.round(sampleRate * frameMs / 1000));

  class FrameRingBuffer {
    constructor(limit) { this.limit = limit; this.frames = []; }
    push(frame) {
      this.frames.push(frame);
      while (this.frames.length > this.limit) this.frames.shift();
    }
    drain() {
      const frames = this.frames;
      this.frames = [];
      return frames;
    }
  }

  globalThis.CoolzhuRealtimeVoiceCapture = {
    frameSamples,
    FrameRingBuffer,
    createSession
  };
})();
~~~

createSession must:

- enumerate audioinput devices after permission;
- choose an explicit requested deviceId and expose the selected label;
- reject Steam Streaming Microphone and Virtual Desktop Audio for physical-mic acceptance;
- create an AudioContext and Blob-backed AudioWorkletProcessor;
- resample to 16 kHz mono Int16 PCM;
- emit 20 ms frames with sessionId, sequence, capturedAtMs;
- retain 1500 ms for barge-in and 8000 ms while the local WebSocket reconnects;
- report frames, bytes, dropped frames, reconnects, and max frame gap;
- fall back to MediaRecorder only with mode=mediarecorder_degraded.

Load realtime_voice_capture.js before app.js in index.html.

- [ ] **Step 4: Integrate app.js without deleting half-duplex fallback**

In audioRealtimeStart, use createSession when requested mode is full_streaming. Route partial/final events to reportAudioRealtimePartial and submitRealtimeFinalTranscript. Keep sttStartDictation for half_duplex_guarded only.

On stop, barge-in, and session generation change, call capture.stop() and invalidate the old session id. SpeechRecognition may render compatibility captions but must not mark provider-native readiness.

- [ ] **Step 5: Run tests**

Run:

~~~powershell
node modules/gui-web/packages/web-console/tools/realtime_voice_capture_contract.test.mjs
cargo test -p coolzhu-web-console returns_expected_content_types --offline
~~~

Expected: PASS; static JavaScript remains served as application/javascript.

- [ ] **Step 6: Commit**

~~~powershell
git add modules/gui-web/packages/web-console/src/realtime_voice_capture.js modules/gui-web/packages/web-console/tools/realtime_voice_capture_contract.test.mjs modules/gui-web/packages/web-console/index.html modules/gui-web/packages/web-console/src/app.js
git commit -m "feat: capture realtime microphone PCM with AudioWorklet"
~~~

### Task 4: Implement cloud streaming STT and local fallback

**Files:**
- Modify: modules/gui-web/packages/web-console/src/realtime_voice_stream.rs
- Modify: modules/gui-web/packages/web-console/src/main.rs: realtime routes and event state

- [ ] **Step 1: Write failing adapter tests with a local WebSocket fixture**

Test that the adapter:

- sends run-task before audio;
- accepts partial and final transcript events;
- sends finish-task on close;
- redacts Authorization from errors;
- reconnects once and preserves sequence ordering.

Use a local Tokio TcpListener fixture; no real cloud call belongs in cargo test.

- [ ] **Step 2: Verify failure**

Run:

~~~powershell
cargo test -p coolzhu-web-console aliyun_streaming_stt --offline
~~~

Expected: FAIL because AliyunStreamingStt is not implemented.

- [ ] **Step 3: Implement the first production provider**

Implement Aliyun Paraformer realtime v2 over wss://dashscope.aliyuncs.com/api-ws/v1/inference/ with:

- Authorization Bearer header from ConfigAudioRealtime.stt_api_key;
- model paraformer-realtime-v2;
- format pcm, sample_rate 16000, punctuation_prediction true, inverse_text_normalization true;
- task-started gate before sending queued PCM;
- partial/final parsing into RealtimeSessionEventDto;
- task-finished and retryable transport error handling;
- one active provider task per realtime session.

Provider selection must return provider_not_configured when provider or key is absent and trigger existing local final-STT fallback without claiming full_streaming.

- [ ] **Step 4: Add the local browser WebSocket route**

Register:

~~~rust
.route(
    "/api/audio/realtime/stream",
    get(realtime_voice_stream::upgrade_pcm_stream),
)
~~~

The handler must require an active realtime session, reject a mismatched session id, update current-session evidence, and publish partial/final/error events through the existing realtime event bus.

- [ ] **Step 5: Run focused and regression tests**

Run:

~~~powershell
cargo test -p coolzhu-web-console aliyun_streaming_stt --offline
cargo test -p coolzhu-web-console realtime_full_stream --offline
~~~

Expected: PASS; no readiness gate changes from a probe-only call.

- [ ] **Step 6: Commit**

~~~powershell
git add modules/gui-web/packages/web-console/src/realtime_voice_stream.rs modules/gui-web/packages/web-console/src/main.rs
git commit -m "feat: stream microphone PCM to cloud STT"
~~~

### Task 5: Add output routing and two-stage barge-in

**Files:**
- Create: modules/gui-web/packages/web-console/src/realtime_audio_output.js
- Modify: modules/gui-web/packages/web-console/index.html
- Modify: modules/gui-web/packages/web-console/src/app.js:13281-13663
- Modify: modules/gui-web/packages/web-console/src/main.rs: realtime AEC readiness
- Modify: modules/gui-web/packages/web-console/tools/realtime_voice_capture_contract.test.mjs

- [ ] **Step 1: Add failing pure behavior tests**

Test:

- a three-frame high signal enters duck but does not cancel;
- sustained speech confirms barge-in;
- six low frames restore volume as noise;
- output selection excludes virtual/disconnected devices;
- stale generation cannot resume or stop the current audio.

- [ ] **Step 2: Verify failure**

Run:

~~~powershell
node modules/gui-web/packages/web-console/tools/realtime_voice_capture_contract.test.mjs
~~~

Expected: FAIL because CoolzhuRealtimeAudioOutput does not exist.

- [ ] **Step 3: Implement the output/barge-in module**

Expose:

~~~javascript
globalThis.CoolzhuRealtimeAudioOutput = {
  listPhysicalOutputs,
  applyOutputSink,
  applyContextSink,
  createBargeInDetector
};
~~~

Use a 600 ms warmup. Enter duck after three candidate frames, confirm speech after ten sustained frames, recover after six low frames or 1500 ms, and restore paused TTS after 3500 ms without partial/final ASR.

Use HTMLMediaElement.setSinkId and AudioContext.setSinkId when present. On devicechange, re-resolve the selected physical output and visibly fall back to default.

- [ ] **Step 4: Correct AEC readiness semantics**

Keep energy/correlation telemetry but rename its status to barge_in_suppression. far_end_reference_aec_ready remains false unless the backend receives a current-generation far-end reference stream and validates it. No amplitude heuristic may set the AEC gate.

- [ ] **Step 5: Run tests**

Run:

~~~powershell
node modules/gui-web/packages/web-console/tools/realtime_voice_capture_contract.test.mjs
cargo test -p coolzhu-web-console realtime_streaming_risk --offline
~~~

Expected: PASS; heuristic suppression alone leaves full-stream AEC readiness false.

- [ ] **Step 6: Commit**

~~~powershell
git add modules/gui-web/packages/web-console/src/realtime_audio_output.js modules/gui-web/packages/web-console/index.html modules/gui-web/packages/web-console/src/app.js modules/gui-web/packages/web-console/src/main.rs modules/gui-web/packages/web-console/tools/realtime_voice_capture_contract.test.mjs
git commit -m "feat: route speech output and guard barge-in"
~~~

### Task 6: Add truthful telemetry and physical-device E2E evidence collection

**Files:**
- Create: modules/gui-web/packages/web-console/tools/realtime_physical_mic_e2e.js
- Modify: modules/gui-web/packages/web-console/src/main.rs
- Modify: modules/gui-web/packages/web-console/src/app.js
- Modify: modules/gui-web/packages/web-console/README.md

- [ ] **Step 1: Write failing event-correlation tests**

Add Rust tests proving full_streaming_ready requires, for one session and turn:

- PCM frames sent;
- provider partial or final received;
- model delta received;
- TTS chunk received;
- browser playing event received;
- current generation ids match.

Also prove synthetic_audio=true and virtual_input=true cannot satisfy physical microphone acceptance.

- [ ] **Step 2: Verify failure**

Run:

~~~powershell
cargo test -p coolzhu-web-console physical_microphone_evidence --offline
~~~

Expected: FAIL because physical-device evidence fields are absent.

- [ ] **Step 3: Implement evidence fields and collector**

The collector must write reports/realtime-voice-physical-e2e.json containing timestamps, session/turn/generation ids, selected input/output labels, provider, partial/final text hash, model delta time, first TTS chunk time, playing time, terminal mode, and explicit PASS/FAIL/BLOCKED fields. It must not write raw PCM, API keys, full model configuration, or browser cookies.

- [ ] **Step 4: Document the operator-assisted phrase**

README must require the user to say:

~~~text
你好 Coolzhu，请用一句话确认实时语音测试成功
~~~

and later interrupt with:

~~~text
停止，请听我说
~~~

The report is PASS only after the user confirms the reply was audible through a physical output.

- [ ] **Step 5: Run focused tests**

Run:

~~~powershell
cargo test -p coolzhu-web-console physical_microphone_evidence --offline
node modules/gui-web/packages/web-console/tools/realtime_physical_mic_e2e.js --help
~~~

Expected: Rust PASS; the collector prints device, phrase, evidence, and privacy requirements.

- [ ] **Step 6: Commit**

~~~powershell
git add modules/gui-web/packages/web-console/tools/realtime_physical_mic_e2e.js modules/gui-web/packages/web-console/src/main.rs modules/gui-web/packages/web-console/src/app.js modules/gui-web/packages/web-console/README.md
git commit -m "test: require physical-device realtime voice evidence"
~~~

### Task 7: Package safely and run the real microphone to speaker loop

**Files:**
- Modify: config/package-manifest.json
- Modify: scripts/test-package-safety.ps1
- Create: reports/realtime-voice-physical-e2e.json

- [ ] **Step 1: Add a failing package-safety assertion**

Require the package to contain realtime_voice_capture.js and realtime_audio_output.js, while rejecting coolzhu.toml, .env files, web-sessions, SQLite databases, PCM/WAV recordings, and any JSON field named api_key, token, or secret from runtime configuration.

- [ ] **Step 2: Verify failure**

Run:

~~~powershell
pwsh -NoProfile -File scripts/test-package-safety.ps1
~~~

Expected: FAIL until new assets and exclusions are represented.

- [ ] **Step 3: Update packaging**

Add focused web assets to package resources. Keep session/model/STT/TTS credentials outside package inputs. Do not add a sample key.

- [ ] **Step 4: Run automated verification**

Run:

~~~powershell
cargo test -p coolzhu-web-console --offline
node modules/gui-web/packages/web-console/tools/realtime_voice_capture_contract.test.mjs
pwsh -NoProfile -File scripts/test-package-safety.ps1
~~~

Expected: all PASS.

- [ ] **Step 5: Run the real front-end test**

Use Computer Use to:

1. launch COOLZHU AGENT and open the realtime voice panel;
2. select 麦克风阵列 (Realtek(R) Audio);
3. select a physical Realtek/default speaker;
4. start full_streaming;
5. prompt the user to speak the fixed phrase;
6. observe partial/final transcript and model delta;
7. verify TTS starts before message_done when provider supports streaming;
8. prompt the user to interrupt with the fixed interrupt phrase;
9. verify old model/TTS generation stops and listening resumes;
10. ask the user to confirm audible playback.

Expected: the JSON report links one physical microphone frame stream, cloud STT, real model turn, TTS stream, and physical output playback. If credentials or provider service are unavailable, record BLOCKED with the exact gate and do not report completion.

- [ ] **Step 6: Build and inspect the package**

Run:

~~~powershell
pwsh -NoProfile -File scripts/package-all.ps1 -Profile release
pwsh -NoProfile -File scripts/test-package-safety.ps1
~~~

Expected: package succeeds and safety test finds no session/model/STT/TTS credentials or recordings.

- [ ] **Step 7: Commit**

~~~powershell
git add config/package-manifest.json scripts/test-package-safety.ps1 reports/realtime-voice-physical-e2e.json
git commit -m "build: package realtime voice without credentials"
~~~
