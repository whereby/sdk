import { createStore, mockSignalEmit } from "../store.setup";
import { randomLocalParticipant, randomRemoteParticipant } from "../../../__mocks__/appMocks";
import { doLockRoom, doKickParticipant, doEndMeeting } from "../../slices/authorization";

describe("actions", () => {
    describe("doLockRoom", () => {
        describe("when authorized", () => {
            it("should lock room", () => {
                const store = createStore({
                    initialState: { localParticipant: randomLocalParticipant({ roleName: "host" }) },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doLockRoom({ locked: true }))).not.toThrow();

                expect(mockSignalEmit).toHaveBeenCalledWith("set_lock", { locked: true });
            });
        });

        describe("when not authorized", () => {
            it("should not lock room", () => {
                const store = createStore({
                    initialState: { localParticipant: randomLocalParticipant({ roleName: "visitor" }) },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doLockRoom({ locked: true }))).toThrow(
                    `Not authorized to perform this action`,
                );

                expect(mockSignalEmit).not.toHaveBeenCalled();
            });
        });
    });

    describe("doKickParticipant", () => {
        describe("when authorized", () => {
            it("should kick client from room", () => {
                const remoteParticipant = randomRemoteParticipant();

                const store = createStore({
                    initialState: {
                        localParticipant: randomLocalParticipant({ roleName: "host" }),
                        remoteParticipants: { remoteParticipants: [remoteParticipant] },
                    },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doKickParticipant({ clientId: remoteParticipant.id }))).not.toThrow();

                expect(mockSignalEmit).toHaveBeenCalledWith("kick_client", {
                    clientId: remoteParticipant.id,
                    reasonId: "kick",
                });
            });
        });

        describe("when not authorized", () => {
            it("should not kick client from room", () => {
                const remoteParticipant = randomRemoteParticipant();

                const store = createStore({
                    initialState: {
                        localParticipant: randomLocalParticipant({ roleName: "visitor" }),
                        remoteParticipants: { remoteParticipants: [remoteParticipant] },
                    },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doKickParticipant({ clientId: remoteParticipant.id }))).toThrow(
                    `Not authorized to perform this action`,
                );

                expect(mockSignalEmit).not.toHaveBeenCalled();
            });
        });
    });

    describe("doEndMeeting", () => {
        const remoteParticipants = [randomRemoteParticipant(), randomRemoteParticipant(), randomRemoteParticipant()];

        describe("when authorized", () => {
            it("should end the meeting for all remote participants", () => {
                const store = createStore({
                    initialState: {
                        localParticipant: randomLocalParticipant({ roleName: "host" }),
                        remoteParticipants: {
                            remoteParticipants,
                        },
                    },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doEndMeeting({ stayBehind: false }))).not.toThrow();

                expect(mockSignalEmit).toHaveBeenCalledWith("kick_client", {
                    clientIds: remoteParticipants.map(({ id }) => id),
                    reasonId: "end-meeting",
                });
            });
        });

        describe("when not authorized", () => {
            it("should not end the meeting for any participants", () => {
                const store = createStore({
                    initialState: {
                        localParticipant: randomLocalParticipant({ roleName: "visitor" }),
                        remoteParticipants: { remoteParticipants },
                    },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doEndMeeting({ stayBehind: false }))).toThrow(
                    `Not authorized to perform this action`,
                );

                expect(mockSignalEmit).not.toHaveBeenCalled();
            });
        });
    });
});
