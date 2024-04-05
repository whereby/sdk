# @whereby.com/browser-sdk

## 2.7.0-beta.0

### Minor Changes

- 9e19728: Rebase beta version on latest main

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
