import { createStore, mockSignalEmit } from "../store.setup";
import { doRemoveSpotlight, doSpotlightParticipant } from "../../slices/spotlights";
import { randomRemoteParticipant, randomString } from "../../../__mocks__/appMocks";

describe("actions", () => {
    describe("doSpotlightParticipant", () => {
        describe("when authorized", () => {
            it("should spotlight participant", () => {
                const participantId = randomString();
                const participant = randomRemoteParticipant({ id: participantId });
                const store = createStore({
                    initialState: {
                        authorization: { roomKey: null, roleName: "host" },
                        remoteParticipants: { remoteParticipants: [participant] },
                    },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doSpotlightParticipant({ id: participantId }))).not.toThrow();

                expect(mockSignalEmit).toHaveBeenCalledWith("add_spotlight", {
                    clientId: participantId,
                    streamId: "0",
                });
            });
        });

        describe("when not authorized", () => {
            it("should not spotlight participant", () => {
                const participantId = randomString();
                const store = createStore({
                    initialState: { authorization: { roomKey: null, roleName: "visitor" } },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doSpotlightParticipant({ id: participantId }))).toThrow(
                    `Not authorized to perform this action`,
                );

                expect(mockSignalEmit).not.toHaveBeenCalled();
            });
        });
    });

    describe("doRemoveSpotlightParticipant", () => {
        describe("when authorized", () => {
            it("should remove spotlight", () => {
                const participantId = randomString();
                const participant = randomRemoteParticipant({ id: participantId });
                const store = createStore({
                    initialState: {
                        authorization: { roomKey: null, roleName: "host" },
                        remoteParticipants: { remoteParticipants: [participant] },
                    },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doRemoveSpotlight({ id: participantId }))).not.toThrow();

                expect(mockSignalEmit).toHaveBeenCalledWith("remove_spotlight", {
                    clientId: participantId,
                    streamId: "0",
                });
            });
        });

        describe("when not authorized", () => {
            it("should not remove spotlight", () => {
                const participantId = randomString();
                const store = createStore({
                    initialState: { authorization: { roomKey: null, roleName: "visitor" } },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doRemoveSpotlight({ id: participantId }))).toThrow(
                    `Not authorized to perform this action`,
                );

                expect(mockSignalEmit).not.toHaveBeenCalled();
            });
        });
    });
});
