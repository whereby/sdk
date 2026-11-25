---
"@whereby.com/core": patch
---

Check every rtcstats value that an action triggers, not only the first one, so roomSessionId is sent when a participant joins, and don't send unchanged object values, such as recording and transcribing, to rtcstats again
