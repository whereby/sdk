# @whereby.com/media

## 1.15.0

### Minor Changes

- fedea8c: Remove TURN enforcement, change node mediasoup device handler

## 1.14.2

### Patch Changes

- ad22d11: Fix reconnect loop in sfuReconnectV2 experiment

## 1.14.1

### Patch Changes

- c149827: Add action to turn camera off for remote participants

## 1.14.0

### Minor Changes

- 03c8fdf: Refactor RTCStats WebSocket connect timing

### Patch Changes

- 73c96f5: Add connection monitor rtc events handling

## 1.13.0

### Minor Changes

- a200436: Add SfuReconnectV2 experiment

## 1.12.2

### Patch Changes

- 58b9d4a: Close RtcStats connection when App is stopped

## 1.12.1

### Patch Changes

- 0d4385b: Add property to acceptnewstream interface

## 1.12.0

### Minor Changes

- 9ce30c8: Enable enforcing turn transport protocol in P2P

## 1.11.1

### Patch Changes

- d01aa03: Revert "media: consider signal connection state on sfu reconnect (#367)"

## 1.11.0

### Minor Changes

- ada15ac: Add notification for client unable to join full room

### Patch Changes

- b5adf9d: Consider signal connection state on SFU reconnect

## 1.10.1

### Patch Changes

- c936c88: Handle headerBytes missing from rtcstatsreport
- 3662377: Handle new track when mediasourceid is missing in rtcstatsreport

## 1.10.0

### Minor Changes

- 0b11d0d: media: Adds turn metrics to stats

### Patch Changes

- 1656f43: Remove debug in p2p replacetrack function

## 1.9.0

### Minor Changes

- 7a765e3: media: Updates rtcstats

## 1.8.0

### Minor Changes

- fb0db35: Add isDialIn property to room participants

### Patch Changes

- e299f5d: Update replace webcam track logic in vega rtcmanager

## 1.7.0

### Minor Changes

- 2eb29a9: Add live transcription events

## 1.6.5

### Patch Changes

- c2459a8: Improve handling of track ended listeners

## 1.6.4

### Patch Changes

- cc38ede: Fix issue where stream resolution is not set, as the consumer is not ready at the time resolution is reported.

## 1.6.3

### Patch Changes

- a211453: Handle senders without tracks when replacing tracks

## 1.6.2

### Patch Changes

- 582dc14: Update mediasoup-client to 3.7.12
- 319881b: Handle cam track ended event

## 1.6.1

### Patch Changes

- 18ec086: Add tracking for replace track issue in P2P
- 7320e54: Adjust SFU rtc manager folder structure to allow breaking it apart and testing
  the units. Also adds test for setting spatial and temporal layers.

## 1.6.0

### Minor Changes

- 80836f3: media: Allows uncapped 1:1 meetings on SFU

## 1.5.1

### Patch Changes

- 74f0c4c: Refactor StatsMonitor to allow for unit testing
- b9013ce: Add sampleInterval to cpu observer

## 1.5.0

### Minor Changes

- 8f146fb: media: Transfers features to sfu server

## 1.4.2

### Patch Changes

- a442c75: Add spotlight functionality

## 1.4.1

### Patch Changes

- 50ce696: Handle case when invalid characters are provided in display name

## 1.4.0

### Minor Changes

- 998eebb: Adds some information to analytics reconnect

## 1.3.9

### Patch Changes

- 7eb3cac: Drop sending of selfId in join_room signal request

## 1.3.8

### Patch Changes

- 48fbe84: Revert 31090cbc

## 1.3.7

### Patch Changes

- ca66fa7: Fix broken issue detectors when audio-only mode is enabled

## 1.3.6

### Patch Changes

- d5ec7f5: Wait for send transport before restarting video producer

## 1.3.5

### Patch Changes

- 8a75b16: Add action to mute participants

## 1.3.4

### Patch Changes

- 48dce0c: media: Allow creating producers for tracks not live yet

## 1.3.3

### Patch Changes

- d75644f: Refactor role name handling from signal

## 1.3.2

### Patch Changes

- b91990a: Reorder export fields, default should be last

## 1.3.1

### Patch Changes

- 5412e6f: Build package to .js instead of .mjs

## 1.3.0

### Minor Changes

- c6ff015: Expose `SignalClient`s `externalId`

## 1.2.1

### Patch Changes

- 5b61e58: Upgrade mediasoup-client to 3.7.3

## 1.2.0

### Minor Changes

- 3c84618: Add commonjs builds of package

## 1.1.3

### Patch Changes

- 6443ce0: Use audio settings for screenshare audio producer

## 1.1.2

### Patch Changes

- 31090cb: media: Handles recovering after trying to produce an ended track

## 1.1.1

### Patch Changes

- 048b147: Add clientClaim to room joined payload

## 1.1.0

### Minor Changes

- 044a207: Set package to public

## 1.1.0

### Minor Changes

- 381c5fd: Release
