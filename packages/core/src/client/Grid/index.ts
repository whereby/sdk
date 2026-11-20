import { Store as AppStore } from "../../redux/store";
import { GridEvents } from "./events";
import { gridStateDefinition } from "./state";
import { GridState } from "./types";
import { doRemoveSpotlight, doSpotlightParticipant } from "../../redux/slices/spotlights";
import { BaseClient } from "../BaseClient";
import { ClientView, RoomIntegrationSessionView } from "../../redux";

export class GridClient extends BaseClient<GridState, GridEvents> {
    constructor(store: AppStore) {
        super(store, gridStateDefinition);
    }

    /* Subscriptions */

    public subscribeClientViews(callback: (clientViews: ClientView[]) => void): () => void {
        return this.subscribeToStateKey("allClientViews", callback);
    }

    public subscribeSpotlightedParticipants(callback: (spotlighted: ClientView[]) => void): () => void {
        return this.subscribeToStateKey("spotlightedParticipants", callback);
    }

    public subscribeNumberOfClientViews(callback: (num: number) => void): () => void {
        return this.subscribeToStateKey("numParticipants", callback);
    }

    public subscribeRunningRoomIntegrations(callback: (sessions: RoomIntegrationSessionView[]) => void): () => void {
        return this.subscribeToStateKey("runningRoomIntegrations", callback);
    }

    /* Actions */

    public spotlightParticipant(id: string) {
        this.store.dispatch(doSpotlightParticipant({ id }));
    }

    public removeSpotlight(id: string) {
        this.store.dispatch(doRemoveSpotlight({ id }));
    }
}
