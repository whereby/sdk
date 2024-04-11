# @whereby.com/core

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
- 300f6ac: Rename `sdkVersion` param in `doAppJoin` to `userAgent`, make it optional with a fallback to core module version and stop exporting the `sdkVersion`

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
