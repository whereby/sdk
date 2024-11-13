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
    breakoutGroup: string | null;
    stickyReaction?: StickyReaction | null;
    isDialIn: boolean;
}

export default class RoomParticipant {
    public readonly displayName;
    public readonly id;
    public readonly stream?: MediaStream;
    public readonly isAudioEnabled: boolean;
    public readonly isLocalParticipant: boolean = false;
    public readonly isVideoEnabled: boolean;
    public readonly breakoutGroup;
    public readonly stickyReaction?: StickyReaction | null;
    public readonly isDialIn: boolean;

    constructor({
        displayName,
        id,
        stream,
        isAudioEnabled,
        isVideoEnabled,
        breakoutGroup,
        stickyReaction,
        isDialIn,
    }: RoomParticipantData) {
        this.displayName = displayName;
        this.id = id;
        this.stream = stream;
        this.isAudioEnabled = isAudioEnabled;
        this.isVideoEnabled = isVideoEnabled;
        this.breakoutGroup = breakoutGroup;
        this.stickyReaction = stickyReaction;
        this.isDialIn = isDialIn;
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
    breakoutGroup: string | null;
    stream: (MediaStream & { inboundId?: string }) | null;
    streams: Stream[];
    newJoiner: boolean;
    presentationStream: (MediaStream & { inboundId?: string }) | null;
    externalId: string | null;
    stickyReaction?: StickyReaction | null;
    isDialIn: boolean;
}

export class LocalParticipant extends RoomParticipant {
    public readonly isLocalParticipant = true;

    constructor({
        displayName,
        id,
        stream,
        isAudioEnabled,
        isVideoEnabled,
        breakoutGroup,
        stickyReaction,
        isDialIn,
    }: RoomParticipantData) {
        super({ displayName, id, stream, isAudioEnabled, isVideoEnabled, breakoutGroup, stickyReaction, isDialIn });
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
