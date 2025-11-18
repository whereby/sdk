# `@whereby.com/camera-effects`

Adds effects on top of camera stream.

Provides a set of presets that can be used to add effects to a camera stream.
This library is meant to be used alongside `@whereby.com/core`, or `@whereby.com/browser-sdk`.
Static assets (images and webassembly files) are hosted on a CDN and loaded at runtime.

## Installation

```bash
npm install @whereby.com/camera-effects
```

or

```bash
yarn add @whereby.com/camera-effects
```

or

```bash
pnpm add @whereby.com/camera-effects
```

## Usage

```typescript
    // Use alongside @whereby.com/core. Can also be used with @whereby.com/browser-sdk
    import { WherebyClient } from "@whereby.com/core";

    const client = new WherebyClient();
    const roomConnection = client.getRoomConnection();

    // Join the room as usual

    // list of available effects
    const [effectPresets, setEffectPresets] = useState<Array<string>>([]);

   // Lazy-loaded and can be called when needed
    async function loadBackgroundEffects() {
        if (!showCameraEffects) return;

        const { getUsablePresets } = await import("@whereby.com/camera-effects");
        const usablePresets = getUsablePresets();
        setEffectPresets(usablePresets);
    }
    
    // Switch to the selected effect
    async function setCameraEffect(effectPreset: string) {
        await roomConnection.switchCameraEffect(effectPreset);
    }
```

## Development

Can be tested in storybook. Since the static assets are hosted on a CDN,
we have two ways of testing locally:

1. Add the environment variable `REACT_APP_IS_DEV=true` to your local `.env` file.
This will make the library load assets from the local assets folder.

2. If you don't use the env variable, or it's set to `false`, the static assets
will be loaded from the CDN as in production.
