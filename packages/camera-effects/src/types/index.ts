interface Pipeline {
    module: {
        createEffectStream: (
            inputStream: MediaStream,
            setup: Pipeline["getDefaultSetup"],
            params: Params,
        ) => Promise<{
            stream: MediaStream;
            stop: () => void;
            updateParams: (params: Params) => Promise<void> | Promise<boolean>;
        }>;
    };
    getDefaultSetup: () => {
        useWebGL?: boolean;
        segmentationModelId?: string;
        logToConsole?: boolean;
        framerate?: number;
        useInsertableStreams?: boolean;
        canvasMemoryLeakWorkaround?: boolean;
        transferType?: string;
        useBackgroundWorker?: boolean;
    };
    canUse: (options: { allowSafari?: boolean }) => boolean;
}

interface Params {
    backgroundUrl?: Promise<unknown> | string;
    backgroundBlur?: {
        amount: "slight" | "normal" | "heavy";
    };
}

interface Preset {
    id: string;
    backgroundUrl?: Promise<string>;
    pipelineConfigs?: {
        [pipelineId: string]: {
            setup?: Pipeline["getDefaultSetup"] | undefined;
            params: Params;
        };
    };
}

export type { Pipeline, Params, Preset };
