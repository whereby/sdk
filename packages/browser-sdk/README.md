<<<<<<< HEAD
# `@whereby.com/browser-sdk`

Whereby browser SDK is a library for seamless integration of Whereby
(https://whereby.com) video calls into your web application.

**For a more detailed set of instructions, including the building of a [simple telehealth app](https://docs.whereby.com/whereby-101/create-your-video-experience/in-a-web-page/using-whereby-react-hooks-build-a-telehealth-app), please see our [documentation](https://docs.whereby.com/reference/react-hooks-reference).**
=======
<<<<<<<< HEAD:README.md
# Whereby SDK
========
# `@whereby.com/browser-sdk`

The Whereby browser SDK is a library for seamless integration of [Whereby](https://whereby.com/) video calls into your web application. You can use it to build a [completely custom integration](https://docs.whereby.com/whereby-101/create-your-video/in-a-web-page/using-whereby-react-hooks-build-a-telehealth-app) of Whereby-powered video calls using [React Hooks](https://docs.whereby.com/reference/react-hooks-reference), or you can also embed pre-built Whereby rooms in a web application [using a Web Component](https://docs.whereby.com/whereby-101/create-your-video/in-a-web-page/using-the-whereby-embed-element).
>>>>>>> browser-sdk/thomas/prepare-repo-move

## Installation

```shell
npm install @whereby.com/browser-sdk
```

or

```shell
yarn add @whereby.com/browser-sdk
```

## Usage

> [!IMPORTANT]
> In order to make use of this functionality, you must have a Whereby account
<<<<<<< HEAD
> from which you can create room urls, either [manually or through our
> API](https://docs.whereby.com/creating-and-deleting-rooms).
=======
> from which you can create room URLs, either [manually or through the Whereby
> API](https://docs.whereby.com/whereby-101/creating-and-deleting-rooms).
>>>>>>> browser-sdk/thomas/prepare-repo-move

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

<<<<<<< HEAD
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
=======
    return <div className="preCallView">
        { /* Render any UI, making use of state */ }
        { cameraDevices.map((d) => (
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
        )) }
        <VideoView muted stream={localStream} />
    </div>;
}

>>>>>>> browser-sdk/thomas/prepare-repo-move
```

#### useRoomConnection

The `useRoomConnection` hook provides a way to connect participants in a given
room, subscribe to state updates, and perform actions on the connection, like
toggling camera or microphone.

```js
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
    const { toggleCamera, toggleMicrophone } = actions;
    const { VideoView } = components;

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
<<<<<<< HEAD
    const { state, actions } = useLocalMedia({ audio: false, video: true });

    return <p>{state.localStream && <VideoView muted stream={state.localStream} />}</p>;
}
=======
  const { state, actions } = useLocalMedia({ audio: false, video: true });

  return (
    <p>{ state.localStream && <VideoView muted stream={state.localStream} /> }</p>
  );
}

>>>>>>> browser-sdk/thomas/prepare-repo-move
```

### Web component for embedding

<<<<<<< HEAD
Use the `<whereby-embed />` web component to make use of Whereby's pre-built
responsive UI. Refer to our
[documentation](https://docs.whereby.com/embedding-rooms/in-a-web-page/using-the-whereby-embed-element)
to learn which attributes are supported.
=======
Use the `<whereby-embed />` web component to make use of Whereby's pre-built responsive UI. Refer to our [guide](https://docs.whereby.com/whereby-101/create-your-video/in-a-web-page/using-the-whereby-embed-element) and 
[Web Component Reference](https://docs.whereby.com/reference/using-the-whereby-embed-element)
to learn which attributes are supported, how to listen to events, and send commands.
>>>>>>> browser-sdk/thomas/prepare-repo-move

#### React

```js
import "@whereby.com/browser-sdk/embed";

const MyComponent = ({ roomUrl }) => {
    return <whereby-embed chat="off" room={roomUrl} />;
};

export default MyComponent;
```

#### In plain HTML

<<<<<<< HEAD
```html
<html>
    <head>
        <script src="...."></script>
    </head>
    <body>
        <div class="container">
            <whereby-embed room="<room_url>" />
=======
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
>>>>>>> browser-sdk/thomas/prepare-repo-move
        </div>
    </body>
</html>
```

> [!NOTE]
> Although we have just higlighted two combinations of how to load and use the
> web component, it should be possible to use this library with all the major
<<<<<<< HEAD
> frontend frameworks.
=======
> frontend frameworks and bundlers.
> 
> If you don't want to use a bundler, you can use a script tag, like so:
> ```
> <script src="https://cdn.srv.whereby.com/embed/v2-embed.js"></script>
> ```

>>>>>>> browser-sdk/thomas/prepare-repo-move

## Migrating from v1 to v2

Migration from v1 to v2 is only relevant for users of the `<whereby-embed />`
web component. The following changes are necessary when upgrading to v2:

<<<<<<< HEAD
-   If you import the web component in your app, you need to add `/embed` to the
    import path, like so `import "whereby.com/browser-sdk/embed"`
-   If you load the web component using a `<script>` tag, the src needs to be
    changed to `https://cdn.srv.whereby.com/embed/v2-embed.js`. In addition, the
    `type="module"` attribute is no longer required and can be removed.
=======
- If you import the web component in your app, you need to add `/embed` to the
  import path, like so `import "whereby.com/browser-sdk/embed"`
- If you load the web component using a `<script>` tag, the src needs to be 
  changed to `https://cdn.srv.whereby.com/embed/v2-embed.js`. In addition, the
  `type="module"` attribute is no longer required and can be removed.
>>>>>>> browser-sdk/thomas/prepare-repo-move

The functionality of the web component should be exactly as the latest version
on the v1 branch, but a TypeScript definition is now available for projects
using this language.
<<<<<<< HEAD
=======
>>>>>>>> browser-sdk/thomas/prepare-repo-move:packages/browser-sdk/README.md
>>>>>>> browser-sdk/thomas/prepare-repo-move
