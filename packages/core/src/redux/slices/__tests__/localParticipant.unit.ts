import { localParticipantSlice } from "../localParticipant";
import { signalEvents } from "../signalConnection/actions";
import { randomSignalClient, randomLocalParticipant } from "../../../__mocks__/appMocks";

describe("localParticipantSlice", () => {
    describe("reducers", () => {
        describe("signalEvents.roomJoined", () => {
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
                        isLocked: false,
                        selfId: localClient.id,
                        room: {
                            clients: [remoteClient, localClient],
                            knockers: [],
                            spotlights: [],
                            session: null,
                        },
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
