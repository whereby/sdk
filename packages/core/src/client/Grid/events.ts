import { ClientView, RoomIntegrationSessionView } from "../../redux";

export const CLIENT_VIEW_CHANGED = "grid:client-view-changed";
export const CLIENT_VIEW_SPOTLIGHTS_CHANGED = "grid:client-view-spotlights-changed";
export const NUMBER_OF_CLIENT_VIEWS_CHANGED = "grid:number-of-client-views-changed";
export const RUNNING_ROOM_INTEGRATIONS_CHANGED = "grid:running-room-integrations-changed";

export type GridEvents = {
    [CLIENT_VIEW_CHANGED]: [clientViews: ClientView[]];
    [CLIENT_VIEW_SPOTLIGHTS_CHANGED]: [clientViews: ClientView[]];
    [NUMBER_OF_CLIENT_VIEWS_CHANGED]: [numClients: number];
    [RUNNING_ROOM_INTEGRATIONS_CHANGED]: [sessions: RoomIntegrationSessionView[]];
};
