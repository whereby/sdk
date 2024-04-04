import { RtcEvents } from "@whereby.com/media";
import { RootState, createStore as createRealStore } from "../store";

export const mockSignalEmit = jest.fn();
export const mockServerSocket = {
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    getManager: () => ({
        on: jest.fn(),
    }),
    once: jest.fn(),
    emit: mockSignalEmit,
};
export const mockRtcManager = {
    addNewStream: jest.fn(),
    acceptNewStream: jest.fn(),
    replaceTrack: jest.fn(),
    removeStream: jest.fn(),
    disconnect: jest.fn(),
    disconnectAll: jest.fn(),
    updateStreamResolution: jest.fn(),
    sendStatsCustomEvent: jest.fn(),
};
export const mockRtcEmitter = {
    emit: jest.fn(),
};

const createRtcDispatcher = ({
    emitter,
}: {
    emitter: { emit: <K extends keyof RtcEvents>(eventName: K, args: RtcEvents[K]) => void };
}) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emitter.emit("rtc_manager_created", { rtcManager: mockRtcManager as any });

    return {
        stopRtcManager: jest.fn(),
    };
};

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();

    console.error = (msg) => {
        throw new Error(`Got console.error: ${msg}`);
    };
    console.warn = (msg) => {
        throw new Error(`Got console.warn: ${msg}`);
    };
});

type StoreOptions = {
    initialState?: Partial<RootState>;
    withSignalConnection?: boolean;
    withRtcManager?: boolean;
};

export const mockServices = {
    apiClient: jest.fn(),
    organizationApiClient: jest.fn(),
    credentialsService: {
        getCredentials: jest.fn(),
    },
    organizationService: {
        fetchOrganization: jest.fn(),
    },
    organizationServiceCache: {
        fetchOrganization: jest.fn(),
    },
    fetchOrganizationFromRoomUrl: jest.fn(),
};

export function createStore({ initialState, withSignalConnection, withRtcManager }: StoreOptions = {}) {
    initialState = initialState || {};

    if (withSignalConnection) {
        initialState.signalConnection = {
            isIdentifyingDevice: false,
            deviceIdentified: true,
            status: "connected",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            socket: mockServerSocket as any,
        };
    }

    if (withRtcManager) {
        initialState.rtcConnection = {
            status: "ready",
            isCreatingDispatcher: false,
            dispatcherCreated: true,
            error: null,
            reportedStreamResolutions: {},
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rtcManagerDispatcher: createRtcDispatcher({ emitter: mockRtcEmitter }) as any,
            rtcManagerInitialized: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rtcManager: mockRtcManager as any,
            isAcceptingStreams: false,
        };
    }

    const store = createRealStore({
        preloadedState: initialState,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        injectServices: mockServices as any,
    });

    return store;
}
