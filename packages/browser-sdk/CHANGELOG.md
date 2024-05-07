# @whereby.com/browser-sdk

## 2.12.2

### Patch Changes

- 5cf454d: Delay resetting the store state until the next joinRoom() API request is called
- Updated dependencies [5cf454d]
  - @whereby.com/core@0.15.1

## 2.12.1

### Patch Changes

- Updated dependencies [ef26bd0]
  - @whereby.com/core@0.15.0

## 2.12.0

### Minor Changes

- 7256e58: organize bool attributes. Add support for topToolbar, toolbarDarkText, cameraEffect, and localization as attributes
- 4a7bd59: Add `endMeeting()` command on embed element

## 2.11.0

### Minor Changes

- 324b52b: Add actions to join and leave Whereby rooms on-demand
- b857c2b: Add stayBehind parameter to endMeeting host room action

### Patch Changes

- Updated dependencies [324b52b]
- Updated dependencies [b857c2b]
  - @whereby.com/core@0.14.0

## 2.10.1

### Patch Changes

- @whereby.com/core@0.13.1

## 2.10.0

### Minor Changes

- 0092158: Add support for meeting_end event on embed element

## 2.9.0

### Minor Changes

- 35dbed6: enable toggling low data mode
- 7fcc0d9: Allow room hosts to kick clients and end the meeting

### Patch Changes

- Updated dependencies [35dbed6]
- Updated dependencies [b31e2f2]
- Updated dependencies [7fcc0d9]
  - @whereby.com/core@0.13.0

## 2.8.1

### Patch Changes

- 6b5dcc9: Add precall check events to whereby embed element events map

## 2.8.0

### Minor Changes

- 8a75b16: Add action to mute participants

### Patch Changes

- Updated dependencies [8a75b16]
  - @whereby.com/core@0.11.0

## 2.7.0-beta.0

### Minor Changes

- 9e19728: Rebase beta version on latest main

## 2.7.0

### Minor Changes

- d75644f: Add roomKey-based authorization and allow room hosts to lock/unlock rooms

### Patch Changes

- Updated dependencies [d75644f]
  - @whereby.com/core@0.10.0

## 2.6.1

### Patch Changes

- dd39593: Provide correct value for `userAgent` when connecting using `browser-sdk`.
- Updated dependencies [6fc07f5]
- Updated dependencies [300f6ac]
  - @whereby.com/core@0.9.0

## 2.6.0

### Minor Changes

- 10df15f: Added attributes for aec, agc, audioDenoiser, and autoHideSelfView

## 2.5.0

### Minor Changes

- fcab2c7: added attributes for roomIntegrations, precallCeremonyCanSkip, and precallPermissionsHelpLink

## 2.4.0

### Minor Changes

- 37e17fd: Add attributes for timer, skipMediaPermissionPrompt, precallCeremony, bottomToolbar, and autoSpotlight

## 2.3.0

### Minor Changes

- 41a9cc2: core: Return client claim when joining a room

### Patch Changes

- Updated dependencies [41a9cc2]
  - @whereby.com/core@0.6.0

## 2.2.2

### Patch Changes

- 1084a44: Listen for client_kicked events and update room ConnectionStatus accordingly
- Updated dependencies [1084a44]
  - @whereby.com/core@0.3.0

## 2.2.1

### Patch Changes

- 4eb75f8: Adds people_toggle to example docs

## 2.2.0

### Minor Changes

- a604e63: Fix RTC stats bug
- 9e8bb39: Update repo field in package.json to point to this repository.

### Patch Changes

- a6972da: Update jslib-media to get rid of private devDependencies. Fixes issue preventing
  customers installing our packages when devDependencies are included.
- fd6c24f: Fix issue which kept camera light on after disabling video
- Updated dependencies [d983b09]
- Updated dependencies [a6972da]
  - @whereby.com/core@0.2.0

## 2.1.0

### Minor Changes

- 9b210c6: Add more types to `<whereby-embed>` web component
- 9b210c6: Add CDN build of react functionality

### Patch Changes

- 9b210c6: Add media-capture to allow permissions on embed element
