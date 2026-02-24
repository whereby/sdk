import { localParticipantSlice, localParticipantSliceInitialState } from "../localParticipant";
import { signalEvents } from "../signalConnection/actions";
import { randomSignalClient, randomLocalParticipant } from "../../../__mocks__/appMocks";
import { SignalRoom } from "@whereby.com/media";

describe("localParticipantSlice", () => {
    describe("reducers", () => {
        describe("signalEvents.roomJoined", () => {
            describe("on error", () => {
                it("should update state", () => {
                    const result = localParticipantSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            error: "room_locked",
                            selfId: "selfId",
                            isClaimed: true,
                            isLocked: true,
                        }),
                    );

                    expect(result).toEqual({
                        ...localParticipantSliceInitialState,
                        id: "selfId",
                        roleName: "none",
                        clientClaim: undefined,
                        breakoutGroup: null,
                    });
                });
            });

            describe("on success", () => {
                it("should update state", () => {
                    const localClient = randomSignalClient({ role: { roleName: "visitor" }, breakoutGroup: "a" });
                    const remoteClient = randomSignalClient();

                    const localParticipant = randomLocalParticipant({
                        id: localClient.id,
                        roleName: "viewer",
                        breakoutGroup: "b",
                    });

                    const result = localParticipantSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            ...localParticipant,
                            selfId: localClient.id,
                            room: {
                                mode: "group",
                                clients: [remoteClient, localClient],
                                knockers: [],
                                spotlights: [],
                                session: null,
                                isClaimed: true,
                                isLocked: true,
                            } as unknown as SignalRoom,
                            clientClaim: localParticipant.clientClaim as string,
                            eventClaim: "",
                        }),
                    );

                    expect(result).toEqual({
                        ...localParticipant,
                        id: localParticipant.id,
                        displayName: "", // not set from roomJoined event
                        roleName: localClient.role.roleName,
                        breakoutGroup: localClient.breakoutGroup,
                        clientClaim: localParticipant.clientClaim,
                    });
                });
            });
        });

        describe("signalEvents.breakoutGroupJoined", () => {
            it("should update the participant", () => {
                const breakoutGroupId = "test_breakout_group";
                const participant = randomLocalParticipant();
                const state = { ...participant };

                const result = localParticipantSlice.reducer(
                    state,
                    signalEvents.breakoutGroupJoined({
                        clientId: participant.id,
                        group: breakoutGroupId,
                    }),
                );

                expect(result).toEqual({
                    ...participant,
                    breakoutGroup: breakoutGroupId,
                });
            });
        });
    });
});
