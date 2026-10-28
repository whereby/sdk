---
"@whereby.com/media": patch
---

Only emit STREAM_ADDED from VegaRtcManager for the remote stream that changed. A client's screenshare starting or
gaining a track no longer also emits its webcam stream left without tracks after the webcam's consumers closed.
