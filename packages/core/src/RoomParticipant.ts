import { RoleName } from "@whereby.com/media";

export interface StickyReaction {
    reaction: string;
    timestamp: string;
}

interface RoomParticipantData {
    breakoutGroup: string | null;
    displayName: string;
    id: string;
    isAudioEnabled: boolean;
    isAudioRecorder: boolean;
    isDialIn: boolean;
    isVideoEnabled: boolean;
    stickyReaction?: StickyReaction | null;
    stream?: MediaStream;
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
    public readonly isAudioRecorder: boolean;

    constructor({
        breakoutGroup,
        displayName,
        id,
        isAudioEnabled,
        isAudioRecorder,
        isDialIn,
        isVideoEnabled,
        stickyReaction,
        stream,
    }: RoomParticipantData) {
        this.displayName = displayName;
        this.id = id;
        this.stream = stream;
        this.isAudioEnabled = isAudioEnabled;
        this.isVideoEnabled = isVideoEnabled;
        this.breakoutGroup = breakoutGroup;
        this.stickyReaction = stickyReaction;
        this.isDialIn = isDialIn;
        this.isAudioRecorder = isAudioRecorder;
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
    breakoutGroup: string | null;
    deviceId: string;
    displayName: string;
    externalId: string | null;
    id: string;
    isAudioEnabled: boolean;
    isAudioRecorder: boolean;
    isDialIn: boolean;
    isLocalParticipant: boolean;
    isVideoEnabled: boolean;
    newJoiner: boolean;
    presentationStream: (MediaStream & { inboundId?: string }) | null;
    roleName: RoleName;
    stickyReaction?: StickyReaction | null;
    stream: (MediaStream & { inboundId?: string }) | null;
    streams: Stream[];
}

export class LocalParticipant extends RoomParticipant {
    public readonly isLocalParticipant = true;

    constructor({
        breakoutGroup,
        displayName,
        id,
        isAudioEnabled,
        isAudioRecorder,
        isDialIn,
        isVideoEnabled,
        stickyReaction,
        stream,
    }: RoomParticipantData) {
        super({
            breakoutGroup,
            displayName,
            id,
            isAudioEnabled,
            isAudioRecorder,
            isDialIn,
            isVideoEnabled,
            stickyReaction,
            stream,
        });
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
    breakoutGroup: string | null;
    stream?: MediaStream;
    isLocal: boolean;
}
