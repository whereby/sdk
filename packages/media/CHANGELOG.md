# @whereby.com/media

## 2.7.0

### Minor Changes

- 6b25d18: Ensure all handles are closed when leaving a room

## 2.6.10

### Patch Changes

- aa8925c: Fix P2P replaceTrack function

## 2.6.9

### Patch Changes

- 9cc0be3: Restore onnegotiationneeded handler after forced renegotiation
- eb00d2b: media: Handles websocket close while running Bandwidth tester

## 2.6.8

### Patch Changes

- 345168f: Encapsulate more analytics in rtcmanagers

## 2.6.7

### Patch Changes

- ec4d584: Encapsulate ice candidate analytics in rtcmanager

## 2.6.6

### Patch Changes

- 74333fd: Add error information to non-error getUserMedia promise rejections

## 2.6.5

### Patch Changes

- 5059e3b: Align investigation analytics for roommodes
- d18d170: Remove deprecated functions

## 2.6.4

### Patch Changes

- ae27326: Add analytics for P2P replace track failure

## 2.6.3

### Patch Changes

- b804fd2: Handle SFU ICE restarts during ws reconnect
- 7c27cdb: Add missing import

## 2.6.2

### Patch Changes

- 8da9afa: Don't update ICE servers for Firefox in SFU calls

## 2.6.1

### Patch Changes

- 4b95fd0: Add cancel knock protocol request

## 2.6.0

### Minor Changes

- 9bacea2: media: Producer CPU overuse watch default

## 2.5.5

### Patch Changes

- a5f001d: Add disconnectDurationLimitOn feature

## 2.5.4

### Patch Changes

- cd89873: media: Fixes rtcstats disconnecting and never reconnecting

## 2.5.3

### Patch Changes

- f95668e: Add feature to await valid room connection

## 2.5.2

### Patch Changes

- 96ff5f3: Handle null error on GUM calls

## 2.5.1

### Patch Changes

- 71ea8ae: media: Defaults to chrome handler when browser unknown

## 2.5.0

### Minor Changes

- 8418cbc: media: Increase to 3 simultaneous screenshares not using simulcast

## 2.4.0

### Minor Changes

- 1903612: media: Adds feature for detecting and acting on simulcast resolution change

## 2.3.0

### Minor Changes

- 94e6296: media: Adds metric for outgoing layer 0 height

## 2.2.0

### Minor Changes

- e3a06ca: Release assistant SDK

### Patch Changes

- e200b78: Add assistant-related errors to RoomJoinedErrors type definition

## 2.1.5

### Patch Changes

- d52b52f: Fix browser adapter access in nodejs

## 2.1.4

### Patch Changes

- ce401f7: Upgrade mediasoup-client to 3.15.7

## 2.1.3

### Patch Changes

- b347996: Re-add check to prevent issues and metrics being collected for disabled tracks

## 2.1.2

### Patch Changes

- f549671: Fix BandwidthTester when using VP9

## 2.1.1

### Patch Changes

- 612f65b: Remove unused dependency
- 63ac735: update mediasoup-client to 3.15.6

## 2.1.0

### Minor Changes

- 007d61b: - Allow disabled tracks to being checked for issues, as active issues wont be cleared out if checks for disabled tracks are ignored
    - Add more typings to files in the webrtc/stats directory
    - Add unit tests for the PeerConnection module in the webrtc/stats directory

### Patch Changes

- 8a46a62: Send cloud recording rtcAnalytics event

## 2.0.0

### Major Changes

- 4242c01: Updates mediasoup client and switches to async device detection

## 1.33.0

### Minor Changes

- 6636f3f: Commits sfuReconnectV2On experiment

## 1.32.1

### Patch Changes

- 329090d: Fix multi-screenshare bug in SFU rooms with VP9 enabled

## 1.32.0

### Minor Changes

- d47b159: Remove p2pVp9On flag
- 3606518: Remove SVC \_KEY encoding flag

## 1.31.0

### Minor Changes

- dd6216c: Remove flag unlimitedBandwidthWhenUsingRelayP2POn

## 1.30.0

### Minor Changes

- 9f3d2e6: Add audio denoiser suspended context issue detector

## 1.29.0

### Minor Changes

- 68f8d85: clean up bandwidth limiting flags

## 1.28.0

### Minor Changes

- 2a9feee: Update preferred codec logic in Group mode rooms

## 1.27.0

### Minor Changes

- ee76ef5: Limit bandwidth for large rooms sending VP9

## 1.26.0

### Minor Changes

- c5e0177: media: Uses new sfu connection logic as default, removes old

## 1.25.1

### Patch Changes

- 2f4e231: media: aborts further host connection attempts when network is seemingly down'

## 1.25.0

### Minor Changes

- 05c7086: media: Introduces other media settings for additional screenshares

## 1.24.0

### Minor Changes

- 794fea1: Prioritise power efficiency when sorting codecs

## 1.23.3

### Patch Changes

- bd95d49: Rename preferHardwareDecodingOn flag to preferP2pHardwareDecodingOn

## 1.23.2

### Patch Changes

- e19d99a: Fix vp9On flag in modifyMediaCapabilities

## 1.23.1

### Patch Changes

- c0d4b36: Fix getMediaSettings call for vega screenshares

## 1.23.0

### Minor Changes

- e9ae7dc: Handle all cases where signalEvents.roomJoined returns error

## 1.22.0

### Minor Changes

- 3e1acc3: Add option to sort codecs by power efficiency

## 1.21.1

### Patch Changes

- 775c2f1: Split vp9On and av1On flags to separate P2P and SFU flags

## 1.21.0

### Minor Changes

- 8d9a19d: media: optionally use fallback turn servers

## 1.20.1

### Patch Changes

- 79350ae: Add endedAt parameter to LiveTranscriptionStoppedEvent typescript definition

## 1.20.0

### Minor Changes

- 595a889: Refactor getStream to allow single device

## 1.19.0

### Minor Changes

- 9bd1e91: Fix setCodecPreferences in Chrome on Mac

## 1.18.1

### Patch Changes

- 144c274: Fix cleanSdp bug that would remove payloads with subtypes where the type matched another payload
- 47f1b36: Exclude captioner in breakout groups

## 1.18.0

### Minor Changes

- 36ffa21: media: Adds vega connection manager

## 1.17.16

### Patch Changes

- 692ed26: Fix mediasoup client imports in Safari17Handler

## 1.17.15

### Patch Changes

- cdd379c: Fix Safari17 mediasoup handler

## 1.17.14

### Patch Changes

- 5476530: Add basic breakout groups support

## 1.17.13

### Patch Changes

- cc22bea: Fix Safari17 Mediasoup handler selection logic

## 1.17.12

### Patch Changes

- c4b4a83: Fix property access of undefined bug in BandwidthTester

## 1.17.11

### Patch Changes

- d46c94f: Add custom Safari17 mediasoup device hanlder

## 1.17.10

### Patch Changes

- 9304948: Handle failed SFU connection in bwtester

## 1.17.9

### Patch Changes

- 1b6e43c: Fix bandwidth tester sfu url

## 1.17.8

### Patch Changes

- 2d5bf4e: Fix quality-limitation-bw issue P2P audio-only mode

## 1.17.7

### Patch Changes

- 2d9abec: Expose removed devices in getUpdatedDevices

## 1.17.6

### Patch Changes

- 482c96d: Update dependencies

## 1.17.5

### Patch Changes

- d144d34: Improve stats collection and add tracking
- 65c020b: Only emit NO_PUBLIC_IP_GATHERED if ICE Agent not connected.

## 1.17.4

### Patch Changes

- dc6bd5c: Add typing to stats collection
- 6ca79b8: Add tracking for stats report parsing

## 1.17.3

### Patch Changes

- 89c008e: Remove getstream2 experiment

## 1.17.2

### Patch Changes

- 392e210: Add missing `breakoutGroup` property to all in-room participants

## 1.17.1

### Patch Changes

- f393639: Add low bandwidth mode

## 1.17.0

### Minor Changes

- 76616f0: media: Option for adding google and cloudflare stun servers

## 1.16.3

### Patch Changes

- eaf5096: Improve periodic packet loss detection

## 1.16.2

### Patch Changes

- b5ec7b9: Extend PacketLossAnalyser to support additional scenario

## 1.16.1

### Patch Changes

- b9aff12: Add periodic packet loss detection

## 1.16.0

### Minor Changes

- 0fa77c4: media: Workround for some sdp errors

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
