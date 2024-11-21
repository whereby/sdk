# @whereby.com/core

## 0.29.0

### Minor Changes

- 392e210: Add missing `breakoutGroup` property to all in-room participants
- 34c8ba4: Add missing `breakoutGroup` property to all in-room screenshares

### Patch Changes

- Updated dependencies [392e210]
  - @whereby.com/media@1.17.2

## 0.28.7

### Patch Changes

- Updated dependencies [f393639]
  - @whereby.com/media@1.17.1

## 0.28.6

### Patch Changes

- Updated dependencies [76616f0]
  - @whereby.com/media@1.17.0

## 0.28.5

### Patch Changes

- Updated dependencies [eaf5096]
  - @whereby.com/media@1.16.3

## 0.28.4

### Patch Changes

- Updated dependencies [b5ec7b9]
  - @whereby.com/media@1.16.2

## 0.28.3

### Patch Changes

- Updated dependencies [b9aff12]
  - @whereby.com/media@1.16.1

## 0.28.2

### Patch Changes

- 30f1c57: Do not allow knocking if room is not locked

## 0.28.1

### Patch Changes

- Updated dependencies [0fa77c4]
  - @whereby.com/media@1.16.0

## 0.28.0

### Minor Changes

- fedea8c: Remove TURN enforcement, change node mediasoup device handler

### Patch Changes

- Updated dependencies [fedea8c]
  - @whereby.com/media@1.15.0

## 0.27.1

### Patch Changes

- Updated dependencies [ad22d11]
  - @whereby.com/media@1.14.2

## 0.27.0

### Minor Changes

- c149827: Add action to turn camera off for remote participants

### Patch Changes

- Updated dependencies [c149827]
  - @whereby.com/media@1.14.1

## 0.26.0

### Minor Changes

- 73c96f5: Add connection monitor rtc events handling

### Patch Changes

- 03c8fdf: Refactor RTCStats WebSocket connect timing
- Updated dependencies [73c96f5]
- Updated dependencies [03c8fdf]
  - @whereby.com/media@1.14.0

## 0.25.1

### Patch Changes

- Updated dependencies [a200436]
  - @whereby.com/media@1.13.0

## 0.25.0

### Minor Changes

- 58b9d4a: Close RtcStats connection when App is stopped

### Patch Changes

- Updated dependencies [58b9d4a]
  - @whereby.com/media@1.12.2

## 0.24.3

### Patch Changes

- 0d4385b: Enforce turn tls for dial-in peerconnections
- Updated dependencies [0d4385b]
  - @whereby.com/media@1.12.1

## 0.24.2

### Patch Changes

- Updated dependencies [9ce30c8]
  - @whereby.com/media@1.12.0

## 0.24.1

### Patch Changes

- Updated dependencies [d01aa03]
  - @whereby.com/media@1.11.1

## 0.24.0

### Minor Changes

- ada15ac: Add notification for client unable to join full room

### Patch Changes

- 6b0db5a: Avoid filtering out non-human-role clients in remoteclients state
- Updated dependencies [b5adf9d]
- Updated dependencies [ada15ac]
  - @whereby.com/media@1.11.0

## 0.23.1

### Patch Changes

- Updated dependencies [c936c88]
- Updated dependencies [3662377]
  - @whereby.com/media@1.10.1

## 0.23.0

### Minor Changes

- d7bad4d: Do not try to connect the room if there's a room connection error.

## 0.22.2

### Patch Changes

- Updated dependencies [0b11d0d]
- Updated dependencies [1656f43]
  - @whereby.com/media@1.10.0

## 0.22.1

### Patch Changes

- Updated dependencies [7a765e3]
  - @whereby.com/media@1.9.0

## 0.22.0

### Minor Changes

- fb0db35: Add isDialIn property to room participants

### Patch Changes

- Updated dependencies [e299f5d]
- Updated dependencies [fb0db35]
  - @whereby.com/media@1.8.0

## 0.21.0

### Minor Changes

- 2eb29a9: Add live transcription events

### Patch Changes

- Updated dependencies [2eb29a9]
  - @whereby.com/media@1.7.0

## 0.20.0

### Minor Changes

- 396251e: Add isDialIn property to the app config

## 0.19.5

### Patch Changes

- Updated dependencies [c2459a8]
  - @whereby.com/media@1.6.5

## 0.19.4

### Patch Changes

- Updated dependencies [cc38ede]
  - @whereby.com/media@1.6.4

## 0.19.3

### Patch Changes

- Updated dependencies [a211453]
  - @whereby.com/media@1.6.3

## 0.19.2

### Patch Changes

- Updated dependencies [582dc14]
- Updated dependencies [319881b]
  - @whereby.com/media@1.6.2

## 0.19.1

### Patch Changes

- Updated dependencies [18ec086]
- Updated dependencies [7320e54]
  - @whereby.com/media@1.6.1

## 0.19.0

### Minor Changes

- e06697c: Remove local media bypass logic for nodejs clients

## 0.18.0

### Minor Changes

- 4b02a01: Exclude non person roles in participant selection

## 0.17.0

### Minor Changes

- 1fcfa6b: Auto spotlight local screenshare

## 0.16.3

### Patch Changes

- Updated dependencies [80836f3]
  - @whereby.com/media@1.6.0

## 0.16.2

### Patch Changes

- Updated dependencies [74f0c4c]
- Updated dependencies [b9013ce]
  - @whereby.com/media@1.5.1

## 0.16.1

### Patch Changes

- Updated dependencies [8f146fb]
  - @whereby.com/media@1.5.0

## 0.16.0

### Minor Changes

- a442c75: Add spotlight functionality
- 4e48abd: Add video grid component
- 9171216: Improve grid component
- 869695f: Add ability to change speaker device
- af71f4e: Add a notifications system to core and expose notifications in the useRoomConnection hook

### Patch Changes

- Updated dependencies [a442c75]
  - @whereby.com/media@1.4.2

## 0.15.2

### Patch Changes

- 50ce696: Handle case when invalid characters are provided in display name
- Updated dependencies [50ce696]
  - @whereby.com/media@1.4.1

## 0.15.1

### Patch Changes

- 5cf454d: Delay resetting the store state until the next joinRoom() API request is called

## 0.15.0

### Minor Changes

- ef26bd0: Export Signal events from core package

## 0.14.0

### Minor Changes

- 324b52b: Add actions to join and leave Whereby rooms on-demand
- b857c2b: Add stayBehind parameter to endMeeting host room action

## 0.13.1

### Patch Changes

- Updated dependencies [998eebb]
  - @whereby.com/media@1.4.0

## 0.13.0

### Minor Changes

- 35dbed6: enable toggling low data mode
- 7fcc0d9: Allow room hosts to kick clients and end the meeting

### Patch Changes

- b31e2f2: refactor doUpdateDeviceList

## 0.12.1

### Patch Changes

- 7eb3cac: Drop sending of selfId in join_room signal request
- Updated dependencies [7eb3cac]
  - @whereby.com/media@1.3.9

## 0.12.0

### Minor Changes

- 0eba48d: Fix signal reconnect flow

## 0.11.1

### Patch Changes

- e0f67e8: Use MediaStream.getTracks() to tell if a screenshare has audio enabled or not. `.getAudioTracks()` is not implemented in some WebRTC implementations.
- 8f6987d: Use `pres-` prefixed clientId as screenshare id for remote participants and "local-screenshare" for local screenshares as a fallback, if the MediaStream has no `id`.

## 0.11.0

### Minor Changes

- 8a75b16: Add action to mute participants

### Patch Changes

- Updated dependencies [8a75b16]
  - @whereby.com/media@1.3.5

## 0.10.0

### Minor Changes

- d75644f: Add roomKey-based authorization and allow room hosts to lock/unlock rooms

### Patch Changes

- Updated dependencies [d75644f]
  - @whereby.com/media@1.3.3

## 0.9.2

### Patch Changes

- b91990a: Reorder export fields, default should be last
- Updated dependencies [b91990a]
  - @whereby.com/media@1.3.2

## 0.9.1

### Patch Changes

- 5412e6f: Bump media
- Updated dependencies [5412e6f]
  - @whereby.com/media@1.3.1

## 0.9.0

### Minor Changes

- 6fc07f5: Expose `RemoteParticipant.externalId`
- 300f6ac: Rename `sdkVersion` param in `doAppConfigure` to `userAgent`, make it optional with a fallback to core module version and stop exporting the `sdkVersion`

### Patch Changes

- Updated dependencies [c6ff015]
  - @whereby.com/media@1.3.0

## 0.8.0

### Minor Changes

- f22e7a1: Replace jslib-media library with the new @whereby.com/media

### Patch Changes

- Updated dependencies [3c84618]
  - @whereby.com/media@1.2.0

## 0.7.0

### Minor Changes

- 689b05a: Update roomConnection and signalConnection status on signal disconnect
  events

## 0.6.0

### Minor Changes

- 41a9cc2: core: Return client claim when joining a room

## 0.5.0

### Minor Changes

- 0de5018: Handle errors while joining a room

## 0.4.0

### Minor Changes

- 3638f73: Use module type for the core package and update jslib-media
- 7eae1d9: Add flag for Node SDK usage

  disables local media and explicitly sets the mediasoup device handler to one
  that supports node

## 0.3.0

### Minor Changes

- 1084a44: Listen for client_kicked events and update room ConnectionStatus accordingly

## 0.2.0

### Minor Changes

- d983b09: Publish core package

### Patch Changes

- a6972da: Update jslib-media to get rid of private devDependencies. Fixes issue preventing
  customers installing our packages when devDependencies are included.
