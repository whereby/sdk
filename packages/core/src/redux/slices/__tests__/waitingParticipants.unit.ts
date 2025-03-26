import { waitingParticipantsSlice, waitingParticipantsSliceInitialState } from "../waitingParticipants";
import { signalEvents } from "../signalConnection/actions";

describe("reducer", () => {
    describe("signalEvents.roomJoined", () => {
        describe("on error", () => {
            it("should return default state", () => {
                const result = waitingParticipantsSlice.reducer(
                    undefined,
                    signalEvents.roomJoined({
                        error: "internal_server_error",
                    }),
                );
                expect(result).toEqual(waitingParticipantsSliceInitialState);
            });
        });

        describe("on success", () => {
            it("should update waitingParticipants array based on knockers in the room", () => {
                const clientId = "client-id";
                const displayName = "Client";

                const state = waitingParticipantsSlice.reducer(
                    undefined,
                    signalEvents.roomJoined({
                        selfId: "self-id",
                        breakoutGroup: null,
                        clientClaim: "client-claim",
                        room: {
                            mode: "normal",
                            clients: [],
                            knockers: [
                                {
                                    clientId,
                                    displayName,
                                    imageUrl: null,
                                    liveVideo: false,
                                    userAvatarUrl: null,
                                    userId: null,
                                },
                            ],
                            spotlights: [],
                            session: null,
                            isClaimed: true,
                            isLocked: true,
                        },
                    }),
                );

                expect(state).toEqual({ waitingParticipants: [{ id: clientId, displayName }] });
            });
        });
    });
});
