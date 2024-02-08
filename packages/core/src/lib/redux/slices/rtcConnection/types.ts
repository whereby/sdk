import { StreamState } from "@browser-sdk/src/lib/RoomParticipant";

export interface StreamStatusUpdate {
    clientId: string;
    streamId: string;
    state: StreamState;
}
