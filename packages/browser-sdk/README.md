# `@whereby.com/browser-sdk`

The Whereby browser SDK is a library for seamless integration of [Whereby](https://whereby.com/) video calls into your web application. You can use it to build a [completely custom integration](https://docs.whereby.com/whereby-101/create-your-video/in-a-web-page/using-whereby-react-hooks-build-a-telehealth-app) of Whereby-powered video calls using [React Hooks](https://docs.whereby.com/reference/react-hooks-reference), or you can also embed pre-built Whereby rooms in a web application [using a Web Component](https://docs.whereby.com/whereby-101/create-your-video/in-a-web-page/using-the-whereby-embed-element).

## Installation

```shell
npm install @whereby.com/browser-sdk
```

or

```shell
yarn add @whereby.com/browser-sdk
```
or

```shell
pnpm add @whereby.com/browser-sdk
```

## Usage

> [!IMPORTANT]
> In order to make use of this functionality, you must have a Whereby account
> from which you can create room URLs, either [manually or through the Whereby
> API](https://docs.whereby.com/whereby-101/creating-and-deleting-rooms).

### React hooks

#### useLocalMedia

The `useLocalMedia` hook enables preview and selection of local devices (camera
& microphone) prior to establishing a connection within a Whereby room. Use
this hook to build rich pre-call experiences, allowing end users to confirm
their device selection up-front. This hook works seamlessly with the
`useRoomConnection` hook described below.

```js
import { useLocalMedia, VideoView } from "@whereby.com/browser-sdk/react";

function MyPreCallUX() {
    const localMedia = useLocalMedia({ audio: false, video: true });

    const { currentCameraDeviceId, cameraDevices, localStream } = localMedia.state;
    const { setCameraDevice, toggleCameraEnabled } = localMedia.actions;

    return (
        <div className="preCallView">
            {/* Render any UI, making use of state */}
            {cameraDevices.map((d) => (
                <p
                    key={d.deviceId}
                    onClick={() => {
                        if (d.deviceId !== currentCameraDeviceId) {
                            setCameraDevice(d.deviceId);
                        }
                    }}
                >
                    {d.label}
                </p>
            ))}
            <VideoView muted stream={localStream} />
        </div>
    );
}
```

#### usePreCallTest

The `usePreCallTest` hook measures the connection between the end user and the
Whereby media servers, so you can warn people about a poor network before they
join a room. It needs no room and no local media, and runs on its own
connection.

Because the test saturates the connection to measure it, run it *before*
joining — running it during a call takes bandwidth away from the call.

```js
import { usePreCallTest } from "@whereby.com/browser-sdk/react";

function MyNetworkCheck() {
    const { state, actions } = usePreCallTest("<room_url>");
    const { status, result, error } = state;

    return (
        <div className="networkCheck">
            <button onClick={() => actions.startTest()} disabled={status === "running"}>
                {status === "running" ? "Testing…" : "Test my connection"}
            </button>

            {status === "completed" && result.success && <p>Your connection looks good.</p>}
            {status === "completed" && result.warning && (
                <p>
                    Your connection may struggle: {result.details.recvAvailableBitrate.toFixed(1)} Mbps down,{" "}
                    {(result.details.recvLoss * 100).toFixed(1)}% packet loss.
                </p>
            )}
            {status === "failed" && <p>Could not test your connection: {error.message}</p>}
        </div>
    );
}
```

##### Browser only

The test captures a canvas as its video track, so it only runs in a browser. Check before you offer it:

```js
import { isPreCallTestSupported } from "@whereby.com/browser-sdk/react";

if (isPreCallTestSupported()) {
    // safe to render your network check UI
}
```

If you call `startTest()` anyway, it fails with `error.reason === "unsupported"`
and a message naming the missing capability.

##### Reading the result

The test runs for a fixed duration, exported as `PRE_CALL_TEST_DURATION_S` if
you want to show a countdown. It is not configurable on purpose: the pass and
warn thresholds below are calibrated for a run of that length, so varying it
would quietly change what a verdict means.

`startTest()` also resolves with the same result object, if you prefer to await
it rather than read `state`. Call `actions.stopTest()` to abort a run.

`result.success` means no problems were found. `result.warning` means the test
completed but the connection is degraded — the flags in `result.details` say
which check tripped: `lowRecvAvailableBitrate` (below 1.5 Mbps), `highSendLoss`
or `highRecvLoss` (above 3% packet loss). A test that could not produce a
verdict at all sets `status` to `"failed"` and fills in `error`.

##### Checking camera, microphone and speakers

Unlike the network test, whether a camera or microphone *works* is a judgement
only the end user can make — they have to see themselves and hear themselves.
The SDK gives you the pieces to build that; the verdict comes from your UI:

- **Camera** — render `localMedia.state.localStream` in a `<VideoView>` and let
  the user switch between `cameraDevices`, then ask "can you see yourself?".
- **Speakers** — play a sound and route it to the chosen device with
  [`HTMLMediaElement.setSinkId()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId)
  using `localMedia.state.currentSpeakerDeviceId`, then ask "can you hear it?".
- **Microphone** — feed the local stream's audio track into a Web Audio
  [`AnalyserNode`](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)
  to draw a level meter, or record a few seconds with `MediaRecorder` and play
  it back, then ask "can you hear yourself?".

Device errors that *are* machine-detectable — blocked permissions, a device
that fails to open — surface on `useLocalMedia` as `cameraDeviceError`,
`microphoneDeviceError` and `startError`.

#### useRoomConnection

The `useRoomConnection` hook provides a way to connect participants in a given
room, subscribe to state updates, and perform actions on the connection, like
toggling camera or microphone.

Note: from V3 this requires the `WherebyProvder` as a parent of this component. See [the docs](https://docs.whereby.com/reference/react-hooks-reference/guides-and-concepts/migrate-from-version-2.x-to-3) for details

```js
import { useEffect } from "react"
import { useRoomConnection } from "@whereby.com/browser-sdk/react";

function MyCallUX( { roomUrl, localStream }) {
    const { state, actions, components } = useRoomConnection(
        "<room_url>"
        {
            localMedia: null, // Supply localMedia from `useLocalMedia` hook, or constraints
            localMediaConstraints: {
                audio: true,
                video: true,
            }
        }
    );

    const { connectionState, remoteParticipants } = state;
    const { toggleCamera, toggleMicrophone, joinRoom, leaveRoom } = actions;
    const { VideoView } = components;

    useEffect(() => {
        /* join the room when this component renders */
        joinRoom()
        return () => leaveRoom()
    }, [])

    return <div className="videoGrid">
        { /* Render any UI, making use of state */ }
        { remoteParticipants.map((p) => (
            <VideoView key={p.id} stream={p.stream} />
        )) }
    </div>;
}

```

#### Usage with Next.js

If you are integrating these React hooks with Next.js, you need to ensure your
custom video experience components are rendered client side, as the underlying
APIs we use are only available in the browser context. Simply add `"use
client";` to the top of component, like in the following example:

```js
"use client";

import { VideoView, useLocalMedia } from "@whereby.com/browser-sdk/react";

export default function MyNextVideoExperience() {
    const { state, actions } = useLocalMedia({ audio: false, video: true });

    return <p>{state.localStream && <VideoView muted stream={state.localStream} />}</p>;
}
```

### Web component for embedding

Use the `<whereby-embed />` web component to make use of Whereby's pre-built responsive UI. Refer to our [guide](https://docs.whereby.com/whereby-101/create-your-video/in-a-web-page/using-the-whereby-embed-element) and
[Web Component Reference](https://docs.whereby.com/reference/using-the-whereby-embed-element)
to learn which attributes are supported, how to listen to events, and send commands.

#### React

```js
import "@whereby.com/browser-sdk/embed";

const MyComponent = ({ roomUrl }) => {
    return <whereby-embed chat="off" room={roomUrl} />;
};

export default MyComponent;
```

#### In plain HTML

You can import it in your project as follows:

```
import "@whereby.com/browser-sdk/embed"
```

And embed rooms using the Web Component.

```
<html>
    <body>
        <div class="container">
            <whereby-embed room="some-room" />
        </div>
    </body>
</html>
```

> [!NOTE]
> Although we have just higlighted two combinations of how to load and use the
> web component, it should be possible to use this library with all the major
> frontend frameworks and bundlers.
>
> If you don't want to use a bundler, you can use a script tag, like so:
>
> ```
> <script src="https://cdn.srv.whereby.com/embed/v2-embed.js"></script>
> ```

## Migrating from v1 to v2

Migration from v1 to v2 is only relevant for users of the `<whereby-embed />`
web component. The following changes are necessary when upgrading to v2:

-   If you import the web component in your app, you need to add `/embed` to the
    import path, like so `import "whereby.com/browser-sdk/embed"`
-   If you load the web component using a `<script>` tag, the src needs to be
    changed to `https://cdn.srv.whereby.com/embed/v2-embed.js`. In addition, the
    `type="module"` attribute is no longer required and can be removed.

The functionality of the web component should be exactly as the latest version
on the v1 branch, but a TypeScript definition is now available for projects
using this language.

## Migrating from version v2.x to v3

Version 3 of the browser-sdk contains three breaking changes:
- WherebyProvider is now required to be rendered, and all usage of browser-sdk needs to be in children of the provider.
- useRoomConnection does not automatically join the room any longer. It's required to manually call joinRoom() from useRoomConnection.actions
- useRoomConnection.components is deprecated.

See [here](https://docs.whereby.com/reference/react-hooks-reference/guides-and-concepts/migrate-from-version-2.x-to-3) for more details
