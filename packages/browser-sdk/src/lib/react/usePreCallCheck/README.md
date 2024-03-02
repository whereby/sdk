# usePreCallCheck
This directory makes up the different parts of the `usePrecallCheck` hook. This 
hook is added to give customers a straightforward way to implement their own UI 
to check if end users will have a good call experience.

To separate concerns, the implementation has been split up into different parts
to allow for more straightforward testing, and also make the check suite easily
extensible.

- useCheckRunner (factory)

  Hook which orchestrates running multiple checks one after the other without any
  user interaction. Keeps track of overall check run status, and provides a unified
  state representation of all the checks.

- useCheck (factory)
  
  Factory for creating a single check to be used by the check runner. Expects a 
  check which implements the `Check` interface defined in `types.js`.

## Specific checks
The `checks` directory contains specific check implementations, all adhering to 
the `Check` interface previously mentioned. Moving forward, `core/media` might 
be a better location for these, as they should not be reliant on React or a
specific JavaScript framework to run (however, they might be browser-specific).

- Camera check
  
  Tries to do gUM asking for only video. Unless previously accepted on the domain,
  this check will prompt the user for camera permissions. The check succeeds once 
  an active video track has been received.

- Mircophone check

  Same as the camera test, this test succeeds when able to retrieve an active 
  audio track.

- Bandwidth check

  Uses the `BandwidthTester` from jslib-media (exported through 
  `@whereby.com/core/media`) to measure available bandwidth and packet loss.


