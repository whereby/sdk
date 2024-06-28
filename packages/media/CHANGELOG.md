# @whereby.com/media

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
