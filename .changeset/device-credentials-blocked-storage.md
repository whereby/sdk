---
"@whereby.com/core": patch
---

Use new device credentials even when they can't be saved to storage. Before, a blocked `localStorage` made the SDK
request new credentials every 2 seconds and the join never completed.
