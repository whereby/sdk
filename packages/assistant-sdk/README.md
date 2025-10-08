# `whereby.com/assistant-sdk`

The `@whereby.com/assistant-sdk` lets you run headless participants in **_Node.js_**. Assistants can join rooms, combine audio from all participants, send messages, and perform in-room actions such as starting recordings.
It powers use cases like transcriptions, captions or streaming to realtime AI agents.
Use this SDK if you want to connect AI or backend services directly into Whereby rooms. For browser apps, start with the [Browser SDK](https://github.com/whereby/sdk/tree/main/packages/browser-sdk) or [React Native SDK](https://github.com/whereby/sdk/tree/main/packages/react-native-sdk).

## Installation

```shell
npm install @whereby.com/assistant-sdk
```

or

```shell
yarn add @whereby.com/assistant-sdk
```

or

```shell
pnpm add @whereby.com/assistant-sdk
```

[!IMPORTANT]
Assistants require [FFmpeg](https://ffmpeg.org/download.html) to be installed and available in your system `PATH` if you want to use combined audio streams.

## Usage

In order to use assistants, you must first create an assistant in your Whereby dashboard. This will give you an API key which you can then pass into your Assistant to allow it to join rooms. See here for more details - **_INSERT DOCS WHEN READY_**

### Getting started

```typescript
import "@whereby.com/assistant-sdk/polyfills"; // Required to run in Node.js
import { Assistant, AUDIO_STREAM_READY } from "@whereby.com/assistant-sdk";

async function main() {
    // Create an assistant instance
    const assistant = new Assistant({
        roomUrl: "https://your-subdwhereby.com/your-room", // Room URL to join
        startCombinedAudioStream: true, // Enable combined audio stream
    });

    // Listen for the audio stream to be ready
    assistant.on(AUDIO_STREAM_READY, (stream) => {
        console.log("Combined audio stream is ready:", stream);
        // You can now pipe this stream to your transcription service or other processing
    });

    // Start the assistant
    await assistant.start();
    console.log("Assistant started and joined the room");
}

main();
```

## Core Concepts

### Combined Audio

Assistants can output a single `MediaStream` that mixes all participant audio. Ideal for transcription, audio only recording or passing to realtime AI services. **_FFmpeg is required for this feature._**

### In-room Actions

Assistants can perform common room operations:

- Send and receive chat messages
- Start and stop cloud recordings
- Spotlight participants
- Request mic/camera changes

### Trigger API

The Trigger API allows you to listen for specific webhooks, and create your assistant when those webhooks are received. This is useful for creating assistants on-demand, for example when a meeting starts. See the [Trigger API docs](https://docs.whereby.com/reference/assistant-sdk-reference/api-reference/trigger) for more details.

The Trigger API:

- Runs a lightweight server to listen for webhooks
- You define `webhookTrigger` - functions that decide whether to start an assistant based on the webhook payload.
- When the trigger condition is met, a `TRIGGER_EVENT_SUCCESS` event is emitted with the webhook payload, and you can create your assistant.

Typical usage:

```typescript
import "@whereby.com/assistant-sdk/polyfills"; // Required to run in Node.js
import { Assistant, Trigger, TRIGGER_EVENT_SUCCESS, AUDIO_STREAM_READY } from "@whereby.com/assistant-sdk";

const trigger = new Trigger({
    webhookTriggers: {
        "room.client.joined": () => true, // Start an assistant when first client joins
    },
    port: 3000, // Port to listen on
});

trigger.on(TRIGGER_EVENT_SuCCESS, async ({ roomUrl }) => {
    // Create and start your assistant when the trigger condition is met
    const assistant = new Assistant({
        roomUrl,
        startCombinedAudioStream: true,
        assistantKey: "your-assistant-key",
    });

    await assistant.start();

    assistant.on(AUDIO_STREAM_READY, (stream) => {
        console.log("Combined audio stream is ready:", stream);
    });
});

trigger.start();
```

## Learn more

- Assistant SDK API reference - [API Reference](https://docs.whereby.com/reference/assistant-sdk-reference)
- Trigger API docs - [API Reference](https://docs.whereby.com/reference/assistant-sdk-reference/api-reference/trigger)
  [Assistant example app](https://github.com/whereby/whereby-assistant-audio-recorder)
