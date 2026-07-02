---
"@whereby.com/media": major
---

Removes rtcStatsService default singleton export.

- Removed rtcStatsService default export
    - **What changed**: The default singleton export has been removed and replaced with a named export `createRtcStatsConnection()`.
    * `P2pRtcManager`, `VegaRtcManager` and `RtcManagerDispatcher` now require `rtcStats` in their constructors
    * `startStatsMonitor`, `subscribeStats` and `subscribeIssues` have gotten a required `rtcStats` argument
    - **How to adapt**: Consuming apps will have to create rtc stats connections using the new export and pass it on to any other module depending on this functionality.
    - **Why**: Having a singleton connection made it harder to test this functionality, and it gave consumers limited possibility to inject options, like overriding the base url for the connection.
