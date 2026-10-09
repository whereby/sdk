---
"@whereby.com/media": patch
---

media: Handle changedHighestPreferredLayer message.
Add analytics on layer switches and the webcam upload's congestion (camOutboundRttInflationMs,
camOutboundCongestedFraction), and stop the stats monitor leaving polling loops behind when it's stopped.
With sfuHighestPreferredLayerTrackingOn, the webcam starts capped at spatial layer 1 until the SFU reports.
The cam analytics are collected whether or not the flag is on, and the stats monitor keeps polling after an
unexpected collection failure.
Keep the requested stream resolutions across SFU reconnects and a remote camera being turned off and on, so the
received videos get their preferred layers again without a layout change
