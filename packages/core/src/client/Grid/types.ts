import { ClientView } from "../../redux";

export interface GridState {
    allClientViews: ClientView[];
    spotlightedParticipants: ClientView[];
    numParticipants: number;
}
