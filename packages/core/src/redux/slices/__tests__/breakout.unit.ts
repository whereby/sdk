import { breakoutSlice, breakoutSliceInitialState } from "../breakout";
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
            describe("on error", () => {
                it("should return default state", () => {
                    const result = breakoutSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            error: "internal_server_error",
                        }),
                    );
                    expect(result).toEqual(breakoutSliceInitialState);
                });
            });

            describe("on success", () => {
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
                            selfId: "selfId",
                            breakoutGroup: null,
                            clientClaim: "clientClaim",
                            eventClaim: "",
                            room: {
                                mode: "normal",
                                clients: [localClient, remoteClient],
                                knockers: [],
                                spotlights: [],
                                session: null,
                                isClaimed: true,
                                isLocked: false,
                                iceServers: {
                                    iceServers: [],
                                },
                                mediaserverConfigTtlSeconds: 0,
                                name: "",
                                organizationId: "",
                                turnServers: [],
                            },
                            breakout: breakoutConfig,
                        }),
                    );

                    expect(result).toEqual(breakoutConfig);
                });
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
