---
"@whereby.com/core": patch
---

Bundle `@whereby.com/audio-denoiser` and `@whereby.com/camera-effects` as direct dependencies instead of optional peer dependencies. Consumers no longer need to install these packages separately to use noise reduction or camera effects. The effect code is still loaded on demand via dynamic import, so there is no impact on initial bundle size for consumers who don't use these features.
