/**
 * Public helpers for the optional camera effects and audio denoiser features.
 *
 * These wrap `@whereby.com/camera-effects` and `@whereby.com/audio-denoiser`,
 * which are bundled with core but loaded on demand via dynamic import. Consumers
 * should reach for these instead of importing the underlying packages directly,
 * so the effect code stays in a lazily-loaded chunk and is never pulled into the
 * main bundle for consumers who don't use these features.
 */

/**
 * List the camera effect preset ids that are usable in the current environment.
 * The camera effects code is loaded on demand the first time this is called.
 */
export async function getUsableCameraEffectPresets(): Promise<string[]> {
    const { getUsablePresets } = await import("@whereby.com/camera-effects");
    return getUsablePresets();
}

/**
 * Whether audio noise suppression is supported in the current browser. The
 * audio denoiser code is loaded on demand the first time this is called.
 */
export async function isAudioDenoiserSupported(): Promise<boolean> {
    const { canUse } = await import("@whereby.com/audio-denoiser");
    return canUse();
}
