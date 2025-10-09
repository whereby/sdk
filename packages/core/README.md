# `@whereby.com/core`

`@whereby.com/core` is the low-level foundation of the Whereby SDK. It exposes a set of containers, actions, and client classes for working with local media and room connections. It's used to power the [Whereby Browser SDK](https://github.com/whereby/sdk/tree/main/packages/browser-sdk), [Whereby Assistants](https://github.com/whereby/sdk/tree/main/packages/assistant-sdk) and [React Native SDK](https://github.com/whereby/sdk/tree/main/packages/react-native-sdk) and other forms of Whereby meetings. It also contains utils which may be useful in custom experiences.

Use Core if you need **fine-grained control** over media and connections, or if you are building a custom integration outside of React. For most web apps, the Browser or React SDKs will be easier starting points.

## Installation

```shell
npm install @whereby.com/core
```

or

```shell
yarn add @whereby.com/core
```

or

```shell
pnpm add @whereby.com/core
```

## Usage

> [!IMPORTANT]
> In order to use `@whereby.com/core`, you must have a Whereby account
> from which you can create room URLs, either [manually or through the Whereby
> API](https://docs.whereby.com/whereby-101/creating-and-deleting-rooms).

### Getting Started

```js
import { WherebyClient } from "@whereby.com/core";

const client = new WherebyClient();

// manage local devices
const localMedia = client.getLocalMedia();

// manage room connection
const roomConnection = client.getRoomConnection();
```

### Core Concepts

#### Local Media

The `LocalMediaClient` controls microphones, cameras and local media tracks. It provides methods to request permissions, start and stop tracks, and switch between devices. It also exposes state such as the list of available devices and the current active tracks.

Typical usage:

```js
// you can pass options or a MediaStream
await localMedia.startMedia({ audio: true, video: true });

localMedia.toggleCamera(); // toggle camera on/off
```

#### Room Connection

The `RoomConnectionClient` handles joining and leaving rooms, as well as observing connection and remote participant state.

Typical usage:

```js
// initialize with your room URL
roomConnection.initialize({
    roomUrl: "https://your-subdomain.whereby.com/your-room",
});

// join the room
try {
    await roomConnection.joinRoom();
} catch(error) {
    console.error("Could not join room", error);
}

// listen for changes in connection state
roomConnection.subscribeToConnectionStatus((state) => {
    console.log("Connection state changed:", state);
});
```

### Learn More

- Core SDK API Reference: [API Documentation](https://docs.whereby.com/reference/core-sdk-reference)
- Core SDK Quick Start Guide: [Quick Start Guide](https://docs.whereby.com/reference/core-sdk-reference/quick-start)
