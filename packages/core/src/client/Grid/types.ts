import { ClientView, RoomIntegrationSessionView } from "../../redux";

export interface GridState {
    allClientViews: ClientView[];
    spotlightedParticipants: ClientView[];
    numParticipants: number;
    runningRoomIntegrations: RoomIntegrationSessionView[];
}
