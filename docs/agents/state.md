# State management (core)

All room logic lives in `packages/core`: one redux store, built with Redux Toolkit's `configureStore` in
`packages/core/src/redux/store.ts`. browser-sdk's React layer and assistant-sdk don't keep room state of their own.
They read it through the client classes in `packages/core/src/client/`. The embed element and react-native-sdk don't use
core's store at all, because the Whereby room in the iframe or WebView runs the room.

```
signal socket / RtcManager (media)  ->  signalEvents / rtcEvents actions  ->  slices + reactors  ->  store
store  ->  client/*/selector.ts  ->  WherebyClient (RoomConnectionClient, LocalMediaClient, GridClient)
       ->  browser-sdk hooks (useRoomConnection, ...), assistant-sdk, apps
```

## Slices

- One file (or folder with `index.ts`) per domain in `packages/core/src/redux/slices/`. A slice file usually holds, in
  this order and under these comment headers: the `createSlice` reducer, `/** Action creators */`, `/** Selectors */`,
  `/** Reactors */`. See `slices/spotlights.ts` for a small complete example.
- Register a new slice's reducer in `combineReducers` in `redux/store.ts` and export the file from `redux/index.ts`.
- `doAppStart` resets the whole store (`rootReducer` in `store.ts`) except `app.initialConfig`, `localMedia`,
  `cameraEffects` and `audioDenoiser`. If new state must survive a rejoin, add it there.
- Server events arrive as actions. `slices/signalConnection/index.ts` turns every socket event into
  `signalEvents.xxx(payload)` (defined in `slices/signalConnection/actions.ts`), and `rtcConnection/actions.ts` does
  the same for RtcManager events. Slices react to them in `extraReducers` with `builder.addCase(signalEvents.xxx, ...)`.
- Payload types for signal messages come from `@whereby.com/media` (`model/protocol.ts`), not from core.

## Action creators

Use the helpers in `redux/thunk.ts`, not raw `createAsyncThunk`, so state and services are typed:

| Helper | Use for |
| --- | --- |
| `createAppThunk` | sync thunk |
| `createAppAsyncThunk` | async thunk with `pending`/`fulfilled`/`rejected` |
| `createRoomConnectedThunk` / `createAsyncRoomConnectedThunk` | only allowed while `roomConnection.status === "connected"` |
| `createAppAuthorizedThunk` | gated by an authorization selector from `slices/authorization.ts` |
| `createAuthorizedRoomConnectedThunk` | both |

- The guarded helpers `console.warn` and return `false` (or reject) when the guard fails. In tests that warn throws (see
  [testing.md](testing.md)).
- Thunks talk to the server by emitting on the signal socket: `selectSignalConnectionRaw(state).socket?.emit(...)`.
- Services (API clients, `fetchOrganizationFromRoomUrl`) come in as the thunk's third argument (`extra.services`). They
  are built in `src/services.ts` and passed to `createStore({ injectServices })`. Don't import them into a slice.
- Names: thunks are `doXxx`, plain slice actions have no prefix (`addSpotlight`).

## Selectors

- `selectXxxRaw = (state: RootState) => state.xxx` returns the raw slice. Derived selectors use `createSelector` from
  `@reduxjs/toolkit` with selector functions as inputs.
- Selectors are exported from the slice file and re-exported through `redux/index.ts` (the `@whereby.com/core/redux`
  entry point), so they're public API. Renaming one is a breaking change.

## Reactors

Two ways to react to state, both from `redux/listenerMiddleware.ts`:

- `createReactor([selectA, selectB], ({ dispatch, getState, extra }, a, b) => { ... })` runs whenever any selector's
  value changes. It must change state so its condition stops holding, or it loops.
- `startAppListening({ actionCreator: doX.fulfilled, effect: ... })` runs on a specific action.

Both are registered at module load, at the bottom of the slice file. Importing the slice registers them.

## Clients (the public API)

- `WherebyClient` (`client/WherebyClient.ts`) creates the store and three clients: `RoomConnectionClient`,
  `LocalMediaClient` and `GridClient`, all extending `BaseClient`.
- Each client folder has `selector.ts` (one `createSelector` that builds the client's state object), `types.ts`,
  `events.ts` (event name constants such as `"connection:status-changed"`) and `index.ts` (the class).
- The class compares state in `handleStateChanges`, calls `subscribeToXxx` subscribers and emits events. Its methods
  dispatch thunks (`toggleAudioOnlyMode(...)` dispatches `doToggleAudioOnlyMode(...)`).
- Adding a feature usually touches the slice, the client and browser-sdk's hooks. See
  [public-api.md](public-api.md).
