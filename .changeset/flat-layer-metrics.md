---
"@whereby.com/media": patch
---

media: Report the webcam's highest preferred layer transitions as flat counts, and measure the layer switch latency for
webcams only.
The transitions are reported as a number per transition (e.g. numCamHighestPreferredSpatialLayerChanges1To2) instead of
the highestPreferredLayerChangeCounts object, and numHighestPreferredLayerChanges is renamed to
numCamHighestPreferredSpatialLayerChanges. numPreferredSpatialLayerChanges and preferredSpatialLayerChangeCounts are
removed. The switch latency is only measured for webcams, as avgCamPreferredSpatialLayerSwitchLatencyMs.
Add numCamPreferredSpatialLayerSwitchTimeouts, the webcam preferred layer switches that didn't land within 10 s.
