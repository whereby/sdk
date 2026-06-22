---
"@whereby.com/camera-effects": patch
---

Guard `Processor.updateParams` against running after the processor was terminated, so a stale or in-flight update no longer dereferences a null engine.
