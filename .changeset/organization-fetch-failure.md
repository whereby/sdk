---
"@whereby.com/core": patch
---

Report a failed organization fetch instead of leaving the join hanging. The connection status becomes `disconnected`
with the error `organization_fetch_failed`, and `joinRoom()` rejects with the same error.
