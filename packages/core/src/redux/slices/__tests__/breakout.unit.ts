import { breakoutSlice } from "../breakout";
import { signalEvents } from "../signalConnection";
import { randomLocalParticipant, randomSignalClient } from "../../../__mocks__/appMocks";

const breakoutConfig = {
    assignments: null,
    groups: {
        a: "Group A",
        b: "Group B",
    },
    groupId: null,
    startedAt: null,
    initiatedBy: null,
    breakoutStartedAt: null,
    breakoutEndedAt: null,
    breakoutNotification: null,
    breakoutTimerDuration: 1800,
    autoMoveToGroup: false,
    moveToGroupGracePeriod: 10,
    autoMoveToMain: false,
    moveToMainGracePeriod: 30,
    enforceAssignment: false,
    breakoutTimerSetting: false,
};

describe("breakoutSlice", () => {
    describe("reducers", () => {
        describe("signalEvents.roomJoined", () => {
            it("should update state if payload.breakout exists", () => {
                const localClient = randomSignalClient();
                const localParticipant = randomLocalParticipant({
                    id: localClient.id,
                });

                const remoteClient = randomSignalClient({ breakoutGroup: "b" });

                const result = breakoutSlice.reducer(
                    undefined,
                    signalEvents.roomJoined({
                        ...localParticipant,
                        isLocked: false,
                        selfId: localClient.id,
                        room: {
                            clients: [localClient, remoteClient],
                            knockers: [],
                            spotlights: [],
                            session: null,
                        },
                        breakout: breakoutConfig,
                    }),
                );

                expect(result).toEqual(breakoutConfig);
            });
        });
        describe("signalEvents.breakoutSessionUpdated", () => {
            it("should update state", () => {
                const result = breakoutSlice.reducer(
                    undefined,
                    signalEvents.breakoutSessionUpdated({
                        ...breakoutConfig,
                    }),
                );
                expect(result).toEqual(breakoutConfig);
            });
        });
    });
});
