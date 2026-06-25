import {
    breakoutSlice,
    breakoutSliceInitialState,
    selectBreakoutMoveToGroupAt,
    selectBreakoutMoveToMainAt,
} from "../breakout";
import { signalEvents } from "../signalConnection";
import { RootState } from "../../store";
import { randomLocalParticipant, randomSignalClient } from "../../../__mocks__/appMocks";

const stateWithBreakout = (overrides: Partial<typeof breakoutSliceInitialState>) =>
    ({ breakout: { ...breakoutSliceInitialState, ...overrides } }) as unknown as RootState;

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

    describe("selectors", () => {
        const startedAt = "2020-01-01T00:00:00.000Z";
        const endedAt = "2020-01-01T01:00:00.000Z";

        describe("selectBreakoutMoveToGroupAt", () => {
            it("returns null when auto-move-to-group is off", () => {
                const state = stateWithBreakout({ autoMoveToGroup: false, breakoutStartedAt: startedAt });
                expect(selectBreakoutMoveToGroupAt(state)).toBeNull();
            });

            it("returns null when the session has not started", () => {
                const state = stateWithBreakout({ autoMoveToGroup: true, breakoutStartedAt: null });
                expect(selectBreakoutMoveToGroupAt(state)).toBeNull();
            });

            it("returns startedAt + grace period when enabled", () => {
                const state = stateWithBreakout({
                    autoMoveToGroup: true,
                    moveToGroupGracePeriod: 10,
                    breakoutStartedAt: startedAt,
                });
                expect(selectBreakoutMoveToGroupAt(state)).toBe(new Date(startedAt).getTime() + 10_000);
            });
        });

        describe("selectBreakoutMoveToMainAt", () => {
            it("returns null when auto-move-to-main is off", () => {
                const state = stateWithBreakout({ autoMoveToMain: false, breakoutEndedAt: endedAt });
                expect(selectBreakoutMoveToMainAt(state)).toBeNull();
            });

            it("returns null when the session has not ended", () => {
                const state = stateWithBreakout({ autoMoveToMain: true, breakoutEndedAt: null });
                expect(selectBreakoutMoveToMainAt(state)).toBeNull();
            });

            it("returns endedAt + grace period when enabled", () => {
                const state = stateWithBreakout({
                    autoMoveToMain: true,
                    moveToMainGracePeriod: 30,
                    breakoutEndedAt: endedAt,
                });
                expect(selectBreakoutMoveToMainAt(state)).toBe(new Date(endedAt).getTime() + 30_000);
            });
        });
    });
});
