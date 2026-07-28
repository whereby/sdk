import { createStore, mockSignalEmit } from "../store.setup";
import {
    doAcceptWaitingParticipant,
    doHoldWaitingParticipant,
    doRejectWaitingParticipant,
} from "../../slices/waitingParticipants";
import { localParticipantSliceInitialState } from "../../slices/localParticipant";

describe("actions", () => {
    it("doAcceptWaitingParticipant", async () => {
        const participantId = "participantId";
        const store = createStore({ withSignalConnection: true, connectToRoom: true });

        store.dispatch(doAcceptWaitingParticipant({ participantId }));

        expect(mockSignalEmit).toHaveBeenCalledWith("handle_knock", {
            action: "accept",
            clientId: participantId,
            knockResponse: {},
        });
    });

    describe("doHoldWaitingParticipant", () => {
        it("emits an empty knockResponse without a message", async () => {
            const participantId = "participantId";
            const store = createStore({ withSignalConnection: true, connectToRoom: true });

            store.dispatch(doHoldWaitingParticipant({ participantId }));

            expect(mockSignalEmit).toHaveBeenCalledWith("handle_knock", {
                action: "hold",
                clientId: participantId,
                knockResponse: {},
            });
        });

        it("includes the message and host display name when a message is provided", async () => {
            const participantId = "participantId";
            const store = createStore({
                withSignalConnection: true,
                connectToRoom: true,
                initialState: { localParticipant: { ...localParticipantSliceInitialState, displayName: "Host" } },
            });

            store.dispatch(doHoldWaitingParticipant({ participantId, response: "  Please wait  " }));

            expect(mockSignalEmit).toHaveBeenCalledWith("handle_knock", {
                action: "hold",
                clientId: participantId,
                knockResponse: { message: "Please wait", sender: { displayName: "Host" } },
            });
        });
    });

    describe("doRejectWaitingParticipant", () => {
        it("emits an empty knockResponse without a message", async () => {
            const participantId = "participantId";
            const store = createStore({ withSignalConnection: true, connectToRoom: true });

            store.dispatch(doRejectWaitingParticipant({ participantId }));

            expect(mockSignalEmit).toHaveBeenCalledWith("handle_knock", {
                action: "reject",
                clientId: participantId,
                knockResponse: {},
            });
        });

        it("includes the message with an anonymous sender when a message is provided", async () => {
            const participantId = "participantId";
            const store = createStore({ withSignalConnection: true, connectToRoom: true });

            store.dispatch(doRejectWaitingParticipant({ participantId, response: "Not this time" }));

            expect(mockSignalEmit).toHaveBeenCalledWith("handle_knock", {
                action: "reject",
                clientId: participantId,
                knockResponse: { message: "Not this time", sender: {} },
            });
        });
    });
});
