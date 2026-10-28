---
"@whereby.com/media": patch
---

Don't emit STREAM_ADDED with an empty webcam stream from VegaRtcManager when a mic score data consumer arrives after
the webcam's consumers closed, e.g. during an SFU reconnect.
