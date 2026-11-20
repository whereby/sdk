import { selectAllClientViews, selectSpotlightedClientViews, selectNumClients } from "../../redux";
import { selectRunningRoomIntegrations } from "../../redux/slices/roomIntegrations";
import type { StateDefinition } from "../BaseClient";
import {
    CLIENT_VIEW_CHANGED,
    CLIENT_VIEW_SPOTLIGHTS_CHANGED,
    NUMBER_OF_CLIENT_VIEWS_CHANGED,
    RUNNING_ROOM_INTEGRATIONS_CHANGED,
    type GridEvents,
} from "./events";
import type { GridState } from "./types";

export const gridStateDefinition: StateDefinition<GridState, GridEvents> = {
    allClientViews: {
        selector: selectAllClientViews,
        emit: (emit, clientViews) => emit(CLIENT_VIEW_CHANGED, clientViews),
    },
    spotlightedParticipants: {
        selector: selectSpotlightedClientViews,
        emit: (emit, spotlighted) => emit(CLIENT_VIEW_SPOTLIGHTS_CHANGED, spotlighted),
    },
    numParticipants: {
        selector: selectNumClients,
        emit: (emit, numParticipants) => emit(NUMBER_OF_CLIENT_VIEWS_CHANGED, numParticipants),
    },
    runningRoomIntegrations: {
        selector: selectRunningRoomIntegrations,
        emit: (emit, sessions) => emit(RUNNING_ROOM_INTEGRATIONS_CHANGED, sessions),
    },
};
