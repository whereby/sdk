---
"@whereby.com/core": minor
---

Initialize rtcstats connection in rtcConnection slice.

Due to breaking change in media package, we need to ensure that the rtcstats connection
is initialized outside the media package itself.
