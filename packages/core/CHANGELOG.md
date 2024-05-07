# @whereby.com/core

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
