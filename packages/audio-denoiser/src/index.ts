import { trackAnnotations } from "@whereby.com/media";

import { assetUrls, USE_CDN_ASSETS } from "./assetUrls";
import { getAudioContext } from "./audioContext";

export type CaptureExceptionContext = {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
};

export type CaptureExceptionFn = (err: Error, ctx?: CaptureExceptionContext) => void;

// Dev-mode imports emit relative URLs like "./assets/denoiser/model.ext.wasm".
// Resolve them against this module's URL so consumers don't need to mount the
// dist/assets folder at a known origin path. Already-absolute (http/blob/data)
// URLs pass through unchanged — that covers the CDN production path.
const resolveAssetUrl = (url: string): string => {
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
    if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("blob:") ||
        url.startsWith("data:")
    ) {
        return url;
    }
    return new URL(url, import.meta.url).href;
};

const getWasmUrl = async (): Promise<string> => {
    if (USE_CDN_ASSETS) {
        return assetUrls.denoiser.wasm!;
    }
    const mod = (await import("../assets/denoiser/model.ext.wasm")) as { default: string };
    return resolveAssetUrl(mod.default);
};

const getProcessorUrl = async (): Promise<string> => {
    if (USE_CDN_ASSETS) {
        return assetUrls.denoiser.processor!;
    }
    const mod = (await import("../assets/denoiser/processor.ext.js?url")) as { default: string };
    return resolveAssetUrl(mod.default);
};

let wasmBufferPromise: Promise<ArrayBuffer> | null = null;
const loadWasmBuffer = async (doCaptureException?: CaptureExceptionFn): Promise<ArrayBuffer> => {
    if (!wasmBufferPromise) {
        wasmBufferPromise = (async () => {
            const url = await getWasmUrl();
            const response = await fetch(url);
            if (!response.ok) {
                const error = new Error(`Failed to fetch denoiser model: ${response.status} ${response.statusText}`);
                doCaptureException?.(error, { tags: { from: "audioDenoiser.loadWasmBuffer" } });
                wasmBufferPromise = null;
                throw error;
            }
            return response.arrayBuffer();
        })();
    }
    return wasmBufferPromise;
};

let workletRegistered: WeakSet<BaseAudioContext> | null = null;
const ensureWorkletRegistered = async (context: BaseAudioContext): Promise<void> => {
    if (!workletRegistered) workletRegistered = new WeakSet();
    if (workletRegistered.has(context)) return;
    const processorUrl = await getProcessorUrl();
    await context.audioWorklet.addModule(processorUrl);
    workletRegistered.add(context);
};

class Denoiser extends AudioWorkletNode {
    constructor(context: AudioContext, wasmBuffer: ArrayBuffer) {
        super(context, "denoiser", {
            channelCountMode: "explicit",
            channelCount: 1,
            channelInterpretation: "speakers",
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            processorOptions: {
                wasmBuffer,
            },
        });
    }
}

export type ApplyAudioDenoiserParams = {
    inputStream: MediaStream;
    doCaptureException?: CaptureExceptionFn;
};

export type AudioDenoiserHandle = {
    outputStream: MediaStream;
    audioContext: AudioContext;
    denoiserNode: AudioWorkletNode;
    stop: () => void;
};

export const canUse = (): boolean => typeof AudioWorkletNode !== "undefined" && typeof AudioContext !== "undefined";

export const warmup = async (): Promise<void> => {
    await loadWasmBuffer();
};

export const applyAudioDenoiser = async ({
    inputStream,
    doCaptureException,
}: ApplyAudioDenoiserParams): Promise<AudioDenoiserHandle> => {
    const inputTrack = inputStream.getAudioTracks()[0];
    const sampleRate = inputTrack?.getSettings().sampleRate;

    const audioContext = getAudioContext("audiodenoiser", sampleRate ? { sampleRate } : undefined);
    const destination = audioContext.createMediaStreamDestination();

    const [wasmBuffer] = await Promise.all([loadWasmBuffer(doCaptureException), ensureWorkletRegistered(audioContext)]);

    const source = audioContext.createMediaStreamSource(inputStream);
    const denoiserNode = new Denoiser(audioContext, wasmBuffer);

    denoiserNode.port.onmessage = (event: MessageEvent<{ error?: string }>) => {
        if (event.data?.error) {
            doCaptureException?.(new Error(event.data.error), {
                tags: { from: "audioDenoiser.onmessage" },
                extra: { sampleRate },
            });
        }
    };
    denoiserNode.onprocessorerror = (errorEvent) => {
        const event = errorEvent as ErrorEvent;
        const error = new Error(`Denoiser processor error: ${event.error} - ${event.message}`);
        doCaptureException?.(error, {
            tags: { from: "audioDenoiser.onprocessorerror" },
            extra: { sampleRate },
        });
    };

    denoiserNode.connect(destination);
    source.connect(denoiserNode);

    const outputTrack = destination.stream.getAudioTracks()[0];

    // Toggling `enabled` on the output track has no effect on the input track
    // (and therefore on what gets denoised + sent). Forward it so muting the
    // output track mutes the underlying mic.
    if (outputTrack && inputTrack) {
        Object.defineProperty(outputTrack, "enabled", {
            get() {
                return inputTrack.enabled;
            },
            set(value: boolean) {
                inputTrack.enabled = value;
            },
        });
    }
    if (outputTrack) {
        trackAnnotations(outputTrack).isEffectTrack = true;
    }

    let stopped = false;
    const stop = () => {
        if (stopped) return;
        stopped = true;
        try {
            denoiserNode.port.postMessage(false);
            source.disconnect();
            denoiserNode.disconnect();
        } catch (error) {
            console.error("Error stopping audio denoiser", error);
        }
    };

    return { outputStream: destination.stream, audioContext, denoiserNode, stop };
};
