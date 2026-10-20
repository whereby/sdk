# Testing

Jest 29 + ts-jest + jsdom, with a shared base config in `tooling/jest/base.js`. Each package's `jest.config.mjs` calls
it. A test file only runs if it's under the package's `src/` and named `*.spec.ts(x)`, `*.test.ts(x)` or
`*.unit.ts(x)`. media also picks up `tests/**/*.spec.ts`.

| Package | Tests today | What they cover |
| --- | --- | --- |
| core | 65 suites, 834 tests | slices, thunks, clients, API clients |
| media | 24 suites, 556 tests | RTC managers, stats, utils |
| browser-sdk | 12 suites, 120 tests | hooks, Grid layout, embed element |
| assistant-sdk | 2 suites, 56 tests | Assistant, AudioMixer |
| react-native-sdk | none (`jest --passWithNoTests`) | its `test` script runs `tsc` too |
| camera-effects, audio-denoiser | none, and no `test` script | |

## Running

- Tests import other workspace packages from their build. `tooling/jest/base.js` maps `@whereby.com/core` and
  `@whereby.com/media` to `../core/dist/legacy-esm.js` and `../media/dist/legacy-esm.js`. Without a build, core's
  tests fail with `Could not locate module @whereby.com/media`. Run `pnpm build` once, and again after changing a
  package that the one you test depends on.
- `pnpm turbo test --filter=<pkg>` builds what the package needs and then runs its lint and unit tests.
- One file: `pnpm --filter @whereby.com/core test:unit src/redux/tests/store/spotlights.spec.ts`. Add
  `-t "<name>"` to filter by test name. Paths are relative to the package.
- core, browser-sdk and assistant-sdk run Jest in ESM mode (`node --experimental-vm-modules ...jest.js`). Run them
  through `test:unit`, not `npx jest`. media uses plain `jest`.
- Jest prints `console.error`/`console.warn` output from some existing tests. It doesn't fail the run.

## core

Most logic lives in core's redux slices, and that's where most tests go.

### Store tests (thunks, reactors, listeners)

- Location: `packages/core/src/redux/tests/store/<slice>.spec.ts`. Helpers in `src/redux/tests/store.setup.ts`.
- `createStore({ initialState, withSignalConnection, withRtcManager, connectToRoom })` builds the real store with every
  slice and mocked services (`mockServices`). The `with*` flags preload a connected signal socket
  (`mockServerSocket`), a ready `mockRtcManager` and a connected room.
- Dispatch the thunk, then assert on `store.getState()`, on the socket (`expect(mockSignalEmit).toHaveBeenCalledWith(
  "add_spotlight", {...})`) or on `mockRtcManager` methods.
- `store.setup.ts` turns on fake timers, clears and restores mocks before each test, and makes `console.error` and
  `console.warn` throw. A guarded thunk that refuses (not authorized, not connected) therefore throws in tests:
  `expect(() => store.dispatch(doX())).toThrow("Not authorized to perform this action")`.
- If you add a field to `rtcConnection`, `signalConnection` or `roomConnection` state, add it to the preloaded state
  in `store.setup.ts` too.

### Slice unit tests (reducers, selectors)

- Location: `packages/core/src/redux/slices/__tests__/<slice>.unit.ts`.
- Reducers: `xxxSlice.reducer(undefined, signalEvents.chatMessage({...}))`, then assert on the result.
- Selectors: call the selector on a hand-built state, or `selectXxx.resultFunc(...)` with its inputs.

### Other core tests

- Clients: `src/client/RoomConnection/__tests__/RoomConnectionClient.spec.ts` (subscriptions and events).
- API clients: `src/api/__tests__/`.
- Random test data: `src/__mocks__/appMocks.ts` (`randomString`, `randomRemoteParticipant`, `randomLocalParticipant`,
  `randomSignalClient`, ...). Browser API mocks (`MediaStream`, `mediaDevices`, `RtcManager`) are in the same folder.

## browser-sdk

- React hooks and components: `src/lib/react/<Thing>/__tests__/`, with `@testing-library/react` (`render`,
  `renderHook`, `act`, `waitFor`).
- The `<whereby-embed>` element: `src/lib/embed/__tests__/embed.spec.ts`. It mocks `heresy` and checks the element's
  attributes and methods. A new embed attribute or command needs a case here.
- Storybook stories (`src/stories/*.stories.tsx`) aren't snapshot-tested. They're for manual checks against a real
  room.

## media

- `packages/media/tests/` mirrors `src/` (`tests/webrtc/P2pRtcManager.spec.ts` and so on), plus `src/**/__tests__/`
  for newer code. Shared helpers in `tests/helpers.ts` and `tests/webrtc/webRtcHelpers.ts`.
- A media change needs tests for both the P2P and SFU (`VegaRtcManager`) paths where it applies.

## E2E

- Playwright in `apps/sample-app/test/testsuites/`, run with `pnpm test:e2e` from the root. It starts the sample app
  (`pnpm dev`, port 5420) and joins real rooms in Chromium, Firefox and WebKit with fake media.
- It needs `WHEREBY_API_KEY` (and `ASSISTANT_KEY` for `assistant.spec.ts`) in the root `.env` or the environment. To
  run against a local backend, also set `REACT_APP_API_BASE_URL` and `REACT_APP_SIGNAL_BASE_URL`.
- `apps/sample-app/test/README.md` still says `yarn` and `playwright.yml`. Use `pnpm`, and the workflow is
  `.github/workflows/e2e.yml`.
- CI runs it on every PR to `main`/`development` and daily. See [ci.md](ci.md).
