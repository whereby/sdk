type CacheKey = `${string}:${number | "default"}`;

const audioContexts = new Map<CacheKey, AudioContext>();

const AudioContextCtor: typeof AudioContext | undefined =
    typeof AudioContext !== "undefined"
        ? AudioContext
        : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

export function getAudioContext(name: string, options?: AudioContextOptions): AudioContext {
    if (!AudioContextCtor) {
        throw new Error("AudioContext is not supported in this environment");
    }
    const key: CacheKey = `${name}:${options?.sampleRate ?? "default"}`;
    let ctx = audioContexts.get(key);
    if (!ctx) {
        ctx = new AudioContextCtor(options);
        audioContexts.set(key, ctx);
    }
    return ctx;
}
