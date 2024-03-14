# @whereby.com/core

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
