---
"@whereby.com/core": patch
---

Stop retrying the device credentials request forever. Each request now times out after 10 seconds and is tried at
most 3 times, 1 and 2 seconds apart. When all attempts fail, `connectionStatus` becomes `"disconnected"`,
`connectionError` becomes `"device_credentials_fetch_failed"` and `joinRoom()` rejects with
`"device_credentials_fetch_failed"`. Credentials that can't be saved to storage are still used for the session.
