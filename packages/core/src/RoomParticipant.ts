import { RoleName } from "@whereby.com/media";

export interface StickyReaction {
    reaction: string;
    timestamp: string;
}

interface RoomParticipantData {
    displayName: string;
    id: string;
    stream?: MediaStream;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    stickyReaction?: StickyReaction | null;
}

export default class RoomParticipant {
    public readonly displayName;
    public readonly id;
    public readonly stream?: MediaStream;
    public readonly isAudioEnabled: boolean;
    public readonly isLocalParticipant: boolean = false;
    public readonly isVideoEnabled: boolean;
    public readonly stickyReaction?: StickyReaction | null;

    constructor({ displayName, id, stream, isAudioEnabled, isVideoEnabled, stickyReaction }: RoomParticipantData) {
        this.displayName = displayName;
        this.id = id;
        this.stream = stream;
        this.isAudioEnabled = isAudioEnabled;
        this.isVideoEnabled = isVideoEnabled;
        this.stickyReaction = stickyReaction;
    }
}

export interface RemoteParticipantData {
    newJoiner: boolean;
    streams: string[];
}

export type StreamState =
    | "new_accept"
    | "to_accept"
    | "old_accept"
    | "done_accept"
    | "to_unaccept"
    | "done_unaccept"
    | "auto";

interface Stream {
    id: string;
    state: StreamState;
}

export interface RemoteParticipant {
    id: string;
    displayName: string;
    roleName: RoleName;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    isLocalParticipant: boolean;
    stream: (MediaStream & { inboundId?: string }) | null;
    streams: Stream[];
    newJoiner: boolean;
    presentationStream: (MediaStream & { inboundId?: string }) | null;
    externalId: string | null;
    stickyReaction?: StickyReaction | null;
}

export class LocalParticipant extends RoomParticipant {
    public readonly isLocalParticipant = true;

    constructor({ displayName, id, stream, isAudioEnabled, isVideoEnabled, stickyReaction }: RoomParticipantData) {
        super({ displayName, id, stream, isAudioEnabled, isVideoEnabled, stickyReaction });
    }
}

export interface WaitingParticipant {
    id: string;
    displayName: string | null;
}

export interface Screenshare {
    participantId: string;
    id: string;
    hasAudioTrack: boolean;
    stream?: MediaStream;
    isLocal: boolean;
}
