# Public API and cross-package features

Everything in a published package's entry points is public API for customers, and semver applies. A rename or removed
export is a major bump. Prefer adding and deprecating (`/** @deprecated Use 'subscribeToLocalScreenshare' instead */`)
over changing.

## Two integration paths

| Path | What it is | Where the logic runs |
| --- | --- | --- |
| Custom UI | `@whereby.com/browser-sdk/react` (`WherebyProvider`, `useRoomConnection`, `useLocalMedia`, `VideoGrid`, ...), `@whereby.com/core` directly, `@whereby.com/assistant-sdk` in Node | core's store, in this repo |
| Embed | `<whereby-embed>` from `@whereby.com/browser-sdk/embed`, and `WherebyEmbed` from `@whereby.com/react-native-sdk/embed` | the Whereby room, loaded in an iframe or WebView. The SDK only sends commands and forwards events over `postMessage` |

An embed command or event does nothing until the Whereby room app handles it, which is a separate change outside this
repo. The room also drops messages from origins that aren't in the room's organization allowed domains, so a Storybook
embed story on `localhost:6006` silently does nothing unless that origin is allowed.

## Adding a Custom UI feature

The usual chain, one commit per package (see the audio-only mode commits in `git log --grep "audio-only"`):

1. media (only if the wire protocol or RtcManager changes): types in `src/model/protocol.ts`, behaviour in
   `src/webrtc/`. Whereby's room web app uses this package too.
2. core, state: slice, thunk and selectors in `src/redux/slices/`, with store tests. See [state.md](state.md).
3. core, client: in `src/client/RoomConnection/` (or `LocalMedia`, `Grid`) add the field to `types.ts` and
   `selector.ts`, a method in `index.ts` that dispatches the thunk, and if callers need to observe it an event name in
   `events.ts` plus a `subscribeToXxx` method. Test in `__tests__/RoomConnectionClient.spec.ts`.
4. core, exports: types that consumers need go in `src/index.ts` (or `src/redux/index.ts` for the
   `@whereby.com/core/redux` entry).
5. browser-sdk: add the action to `src/lib/react/useRoomConnection/types.ts` (`RoomConnectionActions`), wire it in
   `useRoomConnection/index.ts`, add new state to `initialState.ts`, and export new types from `src/lib/react/index.ts`.
6. Storybook: a story or a control in `packages/browser-sdk/src/stories/` to try it against a real room.
7. Changesets: one per published package touched. See [ci.md](ci.md).

## Adding an embed command or event

- `packages/browser-sdk/src/lib/embed/index.ts`: commands are methods that call `this._postCommand("snake_case_name",
  args)` and are typed in the `WherebyEmbedElementCommands` interface. Events are listed in the
  `WherebyEmbedElementEventMap`. Attributes go in `observedAttributes` (boolean ones in `boolAttrs`) and are turned into
  room URL params in `render()`.
- `packages/react-native-sdk/src/embed/index.tsx` mirrors the same commands (`getInjectableJSMessage(...)`) and events.
  Keep the two in step.
- `apps/embed-element-app` is the manual test page for the element.
- Add cases to `src/lib/embed/__tests__/embed.spec.ts`.

## Naming

- `audio`/`video` mean acquisition (`localMediaOptions`, track kinds). `camera`/`microphone` mean the state of a
  device already acquired (`initialMuteStates`, `toggleCamera`, `isCameraEnabled`). Keep them apart.
- Validate arguments on the client side with a clear error even when the backend also enforces the rule.
