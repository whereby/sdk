---
"@whereby.com/browser-sdk": minor
---

Re-export `getUsableCameraEffectPresets()` and `isAudioDenoiserSupported()` from the `@whereby.com/browser-sdk/react` entry, so consumers can query camera effect and audio denoiser capabilities without depending on `@whereby.com/core` directly. Like in core, these load the underlying package on demand via dynamic import.
