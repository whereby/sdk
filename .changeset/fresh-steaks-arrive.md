---
"@whereby.com/core": patch
---

Use MediaStream.getTracks() to tell if a screenshare has audio enabled or not. `.getAudioTracks()` is not implemented in some WebRTC implementations.
