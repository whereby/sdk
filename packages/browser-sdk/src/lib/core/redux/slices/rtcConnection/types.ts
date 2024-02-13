import { StreamState } from "@whereby.com/core";

export interface StreamStatusUpdate {
    clientId: string;
    streamId: string;
    state: StreamState;
}
