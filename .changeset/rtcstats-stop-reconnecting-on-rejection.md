---
"@whereby.com/media": patch
---

Stop reconnecting to rtcstats when the server rejects the connection with 1008, and warn with its reason. Keep at most one pending rtcstats reconnect, instead of one for every event traced while disconnected.
