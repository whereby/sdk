---
"@whereby.com/core": patch
---

Send changes of the signal and RTC connection status, client id, device id, organization id, external id and user role to rtcstats, not only their values when the RtcManager is initialized. Send rtcstats state values only once the RtcManager is initialized, after the first insightsStats event.
