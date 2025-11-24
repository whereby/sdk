declare module "@whereby.com/camera-effects" {
    interface Setup {
        useWebGL?: boolean;
        segmentationModelId?: string;
        logToConsole?: boolean;
        framerate?: number;
        useInsertableStreams?: boolean;
        canvasMemoryLeakWorkaround?: boolean;
        transferType?: string;
        useBackgroundWorker?: boolean;
    }

    interface Params {
        [key: string]: string | number | boolean | undefined;
    }

    export function getUsablePresets({
        filter,
        opts,
    }?: {
        filter?: (s: string) => boolean;
        options?: { allowSafari?: boolean };
    } = {}): string[];
    export function createEffectStream(
        inputStream: MediaStream,
        presetId: string,
        setup?: Setup,
        params?: Params,
    ): Promise<{
        stream: MediaStream;
        stop: () => void;
        tryUpdate: (presetId: string, setup: Setup, params: Params) => Promise<boolean>;
    }>;
}
