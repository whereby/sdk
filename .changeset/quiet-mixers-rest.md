---
"@whereby.com/assistant-sdk": patch
---

Release combined audio resources when the assistant leaves the room. The ffmpeg process, pacer interval and audio sinks created by `getCombinedAudioSink()` are now stopped on leave, and `AudioSink` no longer creates a second native sink that was never stopped.
