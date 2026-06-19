---
"@whereby.com/camera-effects": patch
---

Dedupe the in-flight tflite wasm loads so concurrent `createEffectStream` calls share a single fetch instead of each starting their own.
