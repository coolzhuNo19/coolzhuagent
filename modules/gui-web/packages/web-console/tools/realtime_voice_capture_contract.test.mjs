import assert from "node:assert/strict";

await import("../src/realtime_voice_capture.js");
await import("../src/realtime_audio_output.js");

const api = globalThis.CoolzhuRealtimeVoiceCapture;
assert.equal(api.frameSamples(16000, 20), 320);
const ring = new api.FrameRingBuffer(3);
ring.push({ sequence: 1 });
ring.push({ sequence: 2 });
ring.push({ sequence: 3 });
ring.push({ sequence: 4 });
assert.deepEqual(ring.drain().map((frame) => frame.sequence), [2, 3, 4]);
assert.equal(api.isPhysicalMicrophoneLabel("麦克风阵列 (Realtek(R) Audio)"), true);
assert.equal(api.isPhysicalMicrophoneLabel("Steam Streaming Microphone"), false);
assert.equal(api.isPhysicalMicrophoneLabel("Virtual Desktop Audio"), false);

const output = globalThis.CoolzhuRealtimeAudioOutput;
assert.equal(output.isPhysicalOutputLabel("扬声器 (Realtek(R) Audio)"), true);
assert.equal(output.isPhysicalOutputLabel("Virtual Desktop Audio"), false);

const defaultSinkAbort = await output.applyOutputSink({
  async setSinkId() {
    throw new DOMException("The operation could not be performed and was aborted", "AbortError");
  },
}, "default");
assert.deepEqual(defaultSinkAbort, {
  applied: false,
  reason: "sink_selection_failed",
  deviceId: "default",
  error: "The operation could not be performed and was aborted",
});

const sinkAttempts = [];
const fallbackSink = await output.applyOutputSink({
  async setSinkId(deviceId) {
    sinkAttempts.push(deviceId);
    if (deviceId !== "default") throw new DOMException("device missing", "NotFoundError");
  },
}, "missing-device");
assert.deepEqual(sinkAttempts, ["missing-device", "default"]);
assert.deepEqual(fallbackSink, {
  applied: true,
  deviceId: "default",
  fellBackToDefault: true,
  reason: "requested_sink_failed",
});

let detector = output.createBargeInDetector({ warmupFrames: 0 });
assert.equal(detector.push(0.8).state, "candidate");
assert.equal(detector.push(0.8).state, "candidate");
assert.equal(detector.push(0.8).state, "ducked");
for (let index = 0; index < 7; index += 1) detector.push(0.8);
assert.equal(detector.state(), "confirmed");

detector = output.createBargeInDetector({ warmupFrames: 0 });
for (let index = 0; index < 3; index += 1) detector.push(0.8);
for (let index = 0; index < 6; index += 1) detector.push(0.01);
assert.equal(detector.state(), "quiet");

console.log("realtime voice capture contracts: PASS");
