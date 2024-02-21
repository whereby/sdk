# usePreCallTest
This directly makes up the different parts of the `usePrecallTest` hook. This 
hook is added to give customers a straightforward way to implement their own UI 
to determine if end users will have a good call experience.

## useTestRunner (factory)
Hook which orchestrates running multiple tests one after the other without any
user interaction. Keeps track of overall test run status, and provides a unified
state representation of all the tests.

## useTest (factory)
Factory for creating a single test to be used by the test runner. Expects a 
test which implements the `Test` interface defined in `types.js`.

## Specific tests
This directory also contains specific test implementations, all adhering to the 
`Test` interface previously mentioned. Moving forward, `core/media` might be a
better location for these, as they should not be reliant on React or a specific
JavaScript framework to run.

### Camera test
Tries to do gUM asking for only video. Unless previously accepted on the domain,
this test will prompt the user for camera permissions. The test succeeds once 
an active video track has been received.

### Mircophone test
Same as the camera test, this test succeeds when able to retrieve an active 
audio track.

### Bandwidth test
Uses the `BandwidthTester` from jslib-media (exported through 
`@whereby.com/core/media`) to measure available bandwidth and packet loss.


