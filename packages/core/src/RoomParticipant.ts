import { RoleName } from "@whereby.com/media";

interface RoomParticipantData {
    displayName: string;
    roleName: RoleName;
    id: string;
    stream?: MediaStream;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
}

export default class RoomParticipant {
    public readonly displayName;
    public readonly roleName;
    public readonly id;
    public readonly stream?: MediaStream;
    public readonly isAudioEnabled: boolean;
    public readonly isLocalParticipant: boolean = false;
    public readonly isVideoEnabled: boolean;

    constructor({ displayName, roleName, id, stream, isAudioEnabled, isVideoEnabled }: RoomParticipantData) {
        this.displayName = displayName;
        this.roleName = roleName;
        this.id = id;
        this.stream = stream;
        this.isAudioEnabled = isAudioEnabled;
        this.isVideoEnabled = isVideoEnabled;
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
}

export class LocalParticipant extends RoomParticipant {
    public readonly isLocalParticipant: boolean = true;

    constructor({ displayName, roleName, id, stream, isAudioEnabled, isVideoEnabled }: RoomParticipantData) {
        super({ displayName, roleName, id, stream, isAudioEnabled, isVideoEnabled });
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
