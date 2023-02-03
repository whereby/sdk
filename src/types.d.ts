declare module "heresy" {
    interface AttrChanged {
        attributeName: string;
        oldValue: string | boolean;
    }

    interface element {
        observedAttributes?: string[];
        onattributechanged?: (attrChanged: AttrChanged) => void;
        onconnected?: () => void;
        ondisconnected?: () => void;
        oninit?: () => void;
        render: () => void;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [x: string]: any;
    }

    export function define(elementName: string, element: element): void;
    export function ref(): boolean;
}

declare module "@whereby/jslib-media/src/webrtc/RtcManagerDispatcher" {
    enum RtcEventNames {
        rtc_manager_created = "rtc_manager_created",
        stream_added = "stream_added",
    }

    interface RtcManagerCreatedPayload {
        rtcManager: RtcManager;
    }

    interface RtcStreamAddedPayload {
        clientId: string;
        stream: MediaStream;
        streamId: string;
    }

    type RtcEvents = {
        rtc_manager_created: RtcManagerCreatedPayload;
        stream_added: RtcStreamAddedPayload;
    };

    interface ConstructorArgs {
        emitter: { emit: <K extends keyof RtcEvents>(eventName: K, args: RtcEvents[K]) => void };
        serverSocket: ServerSocket;
        webrtcProvider: {
            getMediaConstraints: () => { audio: boolean; video: boolean };
            deferrable: (clientId: string) => boolean;
        };
        features: {
            lowDataModeEnabled: boolean;
            sfuServerOverrideHost: undefined;
            turnServerOverrideHost: undefined;
            useOnlyTURN: undefined;
            vp9On: boolean;
            h264On: boolean;
            simulcastScreenshareOn: boolean;
        };
    }
    export default class RtcManagerDispatcher {
        constructor(args: ConstructorArgs);
    }
}

declare module "@whereby/jslib-media/src/webrtc/RtcManager" {
    export default interface RtcManager {
        acceptNewStream: ({
            activeBreakout: boolean,
            clientId: string,
            shouldAddLocalVideo: boolean,
            streamId: string,
        }) => void;
        addNewStream: (streamId: string, stream: MediaStream, isAudioEnabled: boolean, isVideoEnabled: boolean) => void;
        disconnect(streamId: string, activeBreakout: boolean): void;
        shouldAcceptStreamsFromBothSides?: () => boolean;
    }
}

declare module "@whereby/jslib-media/src/utils/urls" {
    export function fromLocation({ host }: { host: string }): { subdomain: string };
}

declare module "@whereby/jslib-media/src/utils/ServerSocket" {
    interface SocketConf {
        host?: string;
        path?: string;
        reconnectionDelay?: number;
        reconnectoinDelayMax?: number;
        timeout?: number;
    }

    interface ClientRole {
        roleName: string;
    }

    interface SignalClient {
        displayName: string;
        id: string;
        streams: string[];
        isAudioEnabled: boolean;
        isVideoEnabled: boolean;
        role: ClientRole;
    }

    interface AudioEnabledEvent {
        clientId: string;
        isAudioEnabled: boolean;
    }

    interface ClientLeftEvent {
        clientId: string;
    }
    interface NewClientEvent {
        client: SignalClient;
    }

    interface RoomJoinedEvent {
        room: {
            clients: SignalClient[];
        };
        selfId: string;
    }

    interface VideoEnabledEvent {
        clientId: string;
        isVideoEnabled: boolean;
    }

    interface ClientMetadataReceivedEvent {
        type: string;
        payload: { clientId: string; displayName: string };
    }

    interface SignalEvents {
        audio_enabled: AudioEnabledEvent;
        client_left: ClientLeftEvent;
        client_metadata_received: ClientMetadataReceivedEvent;
        connect: void;
        device_identified: void;
        new_client: NewClientEvent;
        room_joined: RoomJoinedEvent;
        room_left: void;
        video_enabled: VideoEnabledEvent;
    }

    interface IdentifyDeviceRequest {
        deviceCredentials: Credentials;
    }

    interface JoinRoomRequest {
        config: { isAudioEnabled: boolean; isVideoEnabled: boolean };
        organizationId: string;
        roomName: string;
        displayName?: string;
    }

    interface SignalRequests {
        enable_audio: { enabled: boolean };
        enable_video: { enabled: boolean };
        identify_device: IdentifyDeviceRequest;
        join_room: JoinRoomRequest;
        leave_room: void;
        send_client_metadata: { type: string; payload: { displayName?: string } };
    }

    export default class ServerSocket {
        constructor(host: string, conf?: SocketConf);

        connect(): void;
        disconnect(): void;
        emit<K extends keyof SignalRequests>(eventName: K, payload?: SignalRequests[k]);
        on<K extends keyof SignalEvents>(eventName: K, callback: (args: SignalEvents[K]) => void);
        once<K extends keyof SignalEvents>(eventName: K, callback: (args: SignalEvents[K]) => void);
    }
}