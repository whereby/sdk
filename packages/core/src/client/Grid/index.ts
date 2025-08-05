import { Store as AppStore } from "../../redux/store";
import {
    CLIENT_VIEW_CHANGED,
    CLIENT_VIEW_SPOTLIGHTS_CHANGED,
    GridEvents,
    NUMBER_OF_CLIENT_VIEWS_CHANGED,
} from "./events";
import { selectGridState } from "./selector";
import { GridState } from "./types";
import { doRemoveSpotlight, doSpotlightParticipant } from "../../redux/slices/spotlights";
import { BaseClient } from "../BaseClient";
import { ClientView } from "../../redux";

export class GridClient extends BaseClient<GridState, GridEvents> {
    private clientViewSubscribers = new Set<(clientViews: ClientView[]) => void>();
    private spotlightedSubscribers = new Set<(spotlighted: ClientView[]) => void>();
    private numberOfClientViewsSubscribers = new Set<(num: number) => void>();

    constructor(store: AppStore) {
        super(store);
    }

    protected handleStateChanges(state: GridState, previousState: GridState): void {
        if (state.allClientViews !== previousState.allClientViews) {
            this.clientViewSubscribers.forEach((cb) => cb(state.allClientViews));
            this.emit(CLIENT_VIEW_CHANGED, state.allClientViews);
        }

        if (state.spotlightedParticipants !== previousState.spotlightedParticipants) {
            this.spotlightedSubscribers.forEach((cb) => cb(state.spotlightedParticipants));
            this.emit(CLIENT_VIEW_SPOTLIGHTS_CHANGED, state.spotlightedParticipants);
        }

        if (state.numParticipants !== previousState.numParticipants) {
            this.numberOfClientViewsSubscribers.forEach((cb) => cb(state.numParticipants));
            this.emit(NUMBER_OF_CLIENT_VIEWS_CHANGED, state.numParticipants);
        }
    }

    public getState(): GridState {
        return selectGridState(this.store.getState());
    }

    /* Subscriptions */

    public subscribeClientViews(callback: (clientViews: ClientView[]) => void): () => void {
        this.clientViewSubscribers.add(callback);
        return () => this.clientViewSubscribers.delete(callback);
    }

    public subscribeSpotlightedParticipants(callback: (spotlighted: ClientView[]) => void): () => void {
        this.spotlightedSubscribers.add(callback);
        return () => this.spotlightedSubscribers.delete(callback);
    }

    public subscribeNumberOfClientViews(callback: (num: number) => void): () => void {
        this.numberOfClientViewsSubscribers.add(callback);
        return () => this.numberOfClientViewsSubscribers.delete(callback);
    }

    /* Actions */

    public spotlightParticipant(id: string) {
        this.store.dispatch(doSpotlightParticipant({ id }));
    }

    public removeSpotlight(id: string) {
        this.store.dispatch(doRemoveSpotlight({ id }));
    }

    public destroy() {
        super.destroy();
        this.clientViewSubscribers.clear();
        this.spotlightedSubscribers.clear();
        this.numberOfClientViewsSubscribers.clear();
        this.removeAllListeners();
    }
}
