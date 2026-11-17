import { createStore, mockSignalEmit } from "../store.setup";
import { doRemoveSpotlight, doSpotlightParticipant, doSwapSpotlightOrder } from "../../slices/spotlights";
import { randomMediaStream, randomRemoteParticipant, randomString } from "../../../__mocks__/appMocks";
import { CAMERA_STREAM_ID, type RoleName } from "@whereby.com/media";

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
                    streamId: CAMERA_STREAM_ID,
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
                    streamId: CAMERA_STREAM_ID,
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

    describe("doSwapSpotlightOrder", () => {
        const presentationStream = Object.assign(randomMediaStream(), { id: "pres-stream", active: true });
        const setup = (roleName: RoleName) => {
            const a = randomRemoteParticipant({ id: "a" });
            const b = randomRemoteParticipant({ id: "b", presentationStream });
            const c = randomRemoteParticipant({ id: "c" });
            return createStore({
                initialState: {
                    authorization: { roomKey: null, roleName },
                    remoteParticipants: { remoteParticipants: [a, b, c] },
                    spotlights: {
                        sorted: [
                            { clientId: "a", streamId: CAMERA_STREAM_ID },
                            { clientId: "b", streamId: "pres-stream" },
                        ],
                    },
                },
                withSignalConnection: true,
            });
        };

        describe("when authorized", () => {
            it("should ask the server to swap two spotlights, by client view id", () => {
                const store = setup("host");

                store.dispatch(doSwapSpotlightOrder({ id: "a", targetId: "pres-b" }));

                expect(mockSignalEmit).toHaveBeenCalledWith("swap_spotlight_order", {
                    source: { clientId: "a", streamId: CAMERA_STREAM_ID },
                    target: { clientId: "b", streamId: "pres-stream" },
                });
            });

            it("should not send anything when a client view isn't spotlighted", () => {
                const store = setup("host");

                store.dispatch(doSwapSpotlightOrder({ id: "a", targetId: "c" }));
                store.dispatch(doSwapSpotlightOrder({ id: "a", targetId: "gone" }));
                store.dispatch(doSwapSpotlightOrder({ id: "a", targetId: "a" }));

                expect(mockSignalEmit).not.toHaveBeenCalled();
            });
        });

        describe("when not authorized", () => {
            it("should not swap", () => {
                const store = setup("visitor");

                expect(() => store.dispatch(doSwapSpotlightOrder({ id: "a", targetId: "pres-b" }))).toThrow(
                    "Not authorized to perform this action",
                );

                expect(mockSignalEmit).not.toHaveBeenCalled();
            });
        });
    });
});
