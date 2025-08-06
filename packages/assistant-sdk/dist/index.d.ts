import { RoomConnectionClient, RemoteParticipantState } from '@whereby.com/core';
export { RemoteParticipantState } from '@whereby.com/core';
import wrtc from '@roamhq/wrtc';
import EventEmitter, { EventEmitter as EventEmitter$1 } from 'events';
import { PassThrough } from 'stream';

declare const AUDIO_STREAM_READY = "AUDIO_STREAM_READY";
type AssistantEvents = {
    [AUDIO_STREAM_READY]: [{
        stream: MediaStream;
        track: MediaStreamTrack;
    }];
};

type AssistantOptions = {
    assistantKey?: string;
    startCombinedAudioStream: boolean;
};
declare class Assistant extends EventEmitter<AssistantEvents> {
    private assistantKey?;
    private client;
    private roomConnection;
    private localMedia;
    private mediaStream;
    private audioSource;
    private combinedStream;
    constructor({ assistantKey, startCombinedAudioStream }?: AssistantOptions);
    joinRoom(roomUrl: string): Promise<void>;
    getLocalMediaStream(): MediaStream | null;
    getLocalAudioSource(): wrtc.nonstandard.RTCAudioSource | null;
    getRoomConnection(): RoomConnectionClient;
    getCombinedAudioStream(): MediaStream | null;
    getRemoteParticipants(): RemoteParticipantState[];
    startCloudRecording(): void;
    stopCloudRecording(): void;
    sendChatMessage(message: string): void;
    spotlightParticipant(participantId: string): void;
    removeSpotlight(participantId: string): void;
    requestAudioEnable(participantId: string, enable: boolean): void;
    requestVideoEnable(participantId: string, enable: boolean): void;
    acceptWaitingParticipant(participantId: string): void;
    rejectWaitingParticipant(participantId: string): void;
    subscribeToRemoteParticipants(callback: (participants: RemoteParticipantState[]) => void): () => void;
}

type WebhookType = "room.client.joined" | "room.client.left" | "room.session.started" | "room.session.ended";
declare const ASSISTANT_JOIN_SUCCESS = "ASSISTANT_JOIN_SUCCESS";
interface WherebyWebhookBase {
    type: WebhookType;
    apiVersion: "1.0";
    id: string;
    createdAt: string;
}
interface WherebyWebhookInRoom {
    meetingId: string;
    roomName: string;
    roomSessionId: string | null;
}
interface WherebyWebhookDataClient {
    displayName: string;
    participantId: string;
    metadata: string | null;
    externalId: string | null;
}
type WherebyRoleName = "owner" | "member" | "host" | "visitor" | "granted_visitor" | "viewer" | "granted_viewer" | "recorder" | "streamer" | "captioner";
interface WherebyWebhookDataClientJoinLeave {
    roleName: WherebyRoleName;
    numClients: number;
    numClientsByRoleName: Record<WherebyRoleName, number>;
}
interface WherebyWebhookRoomClientJoined extends WherebyWebhookBase {
    data: WherebyWebhookInRoom & WherebyWebhookDataClientJoinLeave & WherebyWebhookDataClient;
}
interface WherebyWebhookRoomClientLeft extends WherebyWebhookBase {
    data: WherebyWebhookInRoom & WherebyWebhookDataClientJoinLeave & WherebyWebhookDataClient;
}
interface WherebyWebhookRoomSessionStarted extends WherebyWebhookBase {
    data: WherebyWebhookInRoom;
}
interface WherebyWebhookRoomSessionEnded extends WherebyWebhookBase {
    data: WherebyWebhookInRoom;
}
type TriggerEvents = {
    [ASSISTANT_JOIN_SUCCESS]: [{
        roomUrl: string;
        triggerWebhook: WherebyWebhookType;
        assistant: Assistant;
    }];
};
type WherebyWebhookType = WherebyWebhookRoomClientJoined | WherebyWebhookRoomClientLeft | WherebyWebhookRoomSessionStarted | WherebyWebhookRoomSessionEnded;
type WherebyWebhookTriggerTypes = {
    "room.client.joined": WherebyWebhookBase;
    "room.client.left": WherebyWebhookBase;
    "room.session.started": WherebyWebhookRoomSessionStarted;
    "room.session.ended": WherebyWebhookBase;
};
type WherebyWebhookTriggers = Partial<{
    [Type in keyof WherebyWebhookTriggerTypes]: (data: WherebyWebhookTriggerTypes[Type]) => boolean;
}>;

interface TriggerOptions {
    webhookTriggers: WherebyWebhookTriggers;
    subdomain: string;
    port?: number;
}
declare class Trigger extends EventEmitter$1<TriggerEvents> {
    private webhookTriggers;
    private subdomain;
    private port;
    constructor({ webhookTriggers, subdomain, port }: TriggerOptions);
    start(): void;
}

declare class AudioSource extends PassThrough {
    constructor();
}
declare class AudioSink extends wrtc.nonstandard.RTCAudioSink {
    private _sink;
    constructor(track: MediaStreamTrack);
    subscribe(cb: (d: {
        samples: Int16Array;
        sampleRate: number;
        channelCount: number;
        bitsPerSample: number;
        numberOfFrames?: number;
    }) => void): () => void;
}

export { ASSISTANT_JOIN_SUCCESS, AUDIO_STREAM_READY, Assistant, AudioSink, AudioSource, Trigger };
