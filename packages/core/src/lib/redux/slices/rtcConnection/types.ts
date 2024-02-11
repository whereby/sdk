import { StreamState } from "../../../RoomParticipant";

export interface StreamStatusUpdate {
    clientId: string;
    streamId: string;
    state: StreamState;
}
