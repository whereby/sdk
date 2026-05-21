# `@whereby.com/audio-denoiser`

Audio denoiser (noise suppression) for microphone streams.

Wraps the input `MediaStream` in an `AudioWorklet` that runs an RNNoise-based
WebAssembly model, returning a new `MediaStream` with the cleaned audio.
Static assets (the WASM model and worklet script) are hosted on a CDN and
loaded at runtime.

## Installation

```bash
npm install @whereby.com/audio-denoiser
```

or

```bash
yarn add @whereby.com/audio-denoiser
```

or

```bash
pnpm add @whereby.com/audio-denoiser
```

## Usage

```typescript
import { applyAudioDenoiser, canUse } from "@whereby.com/audio-denoiser";

if (canUse()) {
    const { outputStream, stop } = await applyAudioDenoiser({
        inputStream: micStream,
        doCaptureException: (err, ctx) => reportError(err, ctx),
    });

    // hand `outputStream` to your RTC pipeline; call `stop()` when done
}
```

`applyAudioDenoiser` also returns `audioContext` and `denoiserNode` for
consumers that need to share the underlying `AudioContext` (e.g. wiring an
audio analyzer onto the same node without creating a second source).

## Development

The static assets (WASM model + worklet script) are hosted on a CDN in
production builds. To exercise the local copies during development, set the
environment variable `REACT_APP_IS_DEV=true` before building. When unset (or
`false`), the build references the CDN as in production.
