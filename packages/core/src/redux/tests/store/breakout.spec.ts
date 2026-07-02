import { createStore, mockSignalEmit } from "../store.setup";
import { randomRemoteParticipant } from "../../../__mocks__/appMocks";
import {
    doBreakoutJoin,
    doStartBreakoutSession,
    doUpdateBreakoutSession,
    doStopBreakoutSession,
    doAssignBreakoutParticipants,
    doAssignAllBreakoutParticipants,
    doUnassignAllBreakoutParticipants,
    doShuffleBreakoutParticipants,
    doExtendBreakoutTimer,
    doStopBreakoutTimer,
    createBreakoutGroups,
    defaultBreakoutGroupName,
    breakoutSliceInitialState,
} from "../../slices/breakout";

describe("actions", () => {
    it("doBreakoutJoin", () => {
        const store = createStore({ withSignalConnection: true, connectToRoom: true });

        store.dispatch(doBreakoutJoin({ group: "a" }));

        expect(mockSignalEmit).toHaveBeenCalledWith("join_breakout_group", { group: "a" });
    });

    describe("doStartBreakoutSession", () => {
        describe("when authorized", () => {
            it("should emit update_breakout_session with active: true", () => {
                const store = createStore({
                    initialState: { authorization: { roomKey: null, roleName: "host" } },
                    withSignalConnection: true,
                });

                const groups = { a: "Group A", b: "Group B" };

                expect(() => store.dispatch(doStartBreakoutSession({ groups }))).not.toThrow();

                expect(mockSignalEmit).toHaveBeenCalledWith("update_breakout_session", {
                    groups,
                    active: true,
                });
            });
        });

        describe("when not authorized", () => {
            it("should not emit", () => {
                const store = createStore({
                    initialState: { authorization: { roomKey: null, roleName: "visitor" } },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doStartBreakoutSession({ groups: { a: "Group A" } }))).toThrow(
                    `Not authorized to perform this action`,
                );

                expect(mockSignalEmit).not.toHaveBeenCalled();
            });
        });
    });

    describe("doUpdateBreakoutSession", () => {
        it("should emit update_breakout_session with the given options when authorized", () => {
            const store = createStore({
                initialState: { authorization: { roomKey: null, roleName: "host" } },
                withSignalConnection: true,
            });

            const groups = { a: "Group A", b: "Group B", c: "Group C" };

            expect(() => store.dispatch(doUpdateBreakoutSession({ groups, enforceAssignment: true }))).not.toThrow();

            expect(mockSignalEmit).toHaveBeenCalledWith("update_breakout_session", {
                groups,
                enforceAssignment: true,
            });
        });

        it("should not emit when not authorized", () => {
            const store = createStore({
                initialState: { authorization: { roomKey: null, roleName: "visitor" } },
                withSignalConnection: true,
            });

            expect(() => store.dispatch(doUpdateBreakoutSession({ enforceAssignment: true }))).toThrow(
                `Not authorized to perform this action`,
            );

            expect(mockSignalEmit).not.toHaveBeenCalled();
        });

        it("should send a grace period when enabling autoMoveToGroup without one", () => {
            const store = createStore({
                initialState: { authorization: { roomKey: null, roleName: "host" } },
                withSignalConnection: true,
            });

            store.dispatch(doUpdateBreakoutSession({ autoMoveToGroup: true }));

            expect(mockSignalEmit).toHaveBeenCalledWith("update_breakout_session", {
                autoMoveToGroup: true,
                moveToGroupGracePeriod: 10,
            });
        });

        it("should send a grace period when enabling autoMoveToMain without one", () => {
            const store = createStore({
                initialState: { authorization: { roomKey: null, roleName: "host" } },
                withSignalConnection: true,
            });

            store.dispatch(doUpdateBreakoutSession({ autoMoveToMain: true }));

            expect(mockSignalEmit).toHaveBeenCalledWith("update_breakout_session", {
                autoMoveToMain: true,
                moveToMainGracePeriod: 30,
            });
        });

        it("should not override an explicitly provided grace period", () => {
            const store = createStore({
                initialState: { authorization: { roomKey: null, roleName: "host" } },
                withSignalConnection: true,
            });

            store.dispatch(doUpdateBreakoutSession({ autoMoveToGroup: true, moveToGroupGracePeriod: 25 }));

            expect(mockSignalEmit).toHaveBeenCalledWith("update_breakout_session", {
                autoMoveToGroup: true,
                moveToGroupGracePeriod: 25,
            });
        });

        it("should not inject a grace period when disabling autoMoveToGroup", () => {
            const store = createStore({
                initialState: { authorization: { roomKey: null, roleName: "host" } },
                withSignalConnection: true,
            });

            store.dispatch(doUpdateBreakoutSession({ autoMoveToGroup: false }));

            expect(mockSignalEmit).toHaveBeenCalledWith("update_breakout_session", { autoMoveToGroup: false });
        });
    });

    describe("doStopBreakoutSession", () => {
        it("should emit update_breakout_session with active: false when authorized", () => {
            const store = createStore({
                initialState: { authorization: { roomKey: null, roleName: "host" } },
                withSignalConnection: true,
            });

            expect(() => store.dispatch(doStopBreakoutSession())).not.toThrow();

            expect(mockSignalEmit).toHaveBeenCalledWith("update_breakout_session", { active: false });
        });

        it("should not emit when not authorized", () => {
            const store = createStore({
                initialState: { authorization: { roomKey: null, roleName: "visitor" } },
                withSignalConnection: true,
            });

            expect(() => store.dispatch(doStopBreakoutSession())).toThrow(`Not authorized to perform this action`);

            expect(mockSignalEmit).not.toHaveBeenCalled();
        });
    });

    describe("doAssignBreakoutParticipants", () => {
        it("should emit update_breakout_session with the assignments when authorized", () => {
            const store = createStore({
                initialState: {
                    authorization: { roomKey: null, roleName: "host" },
                    remoteParticipants: {
                        remoteParticipants: [
                            randomRemoteParticipant({ id: "client-1", deviceId: "device-1" }),
                            randomRemoteParticipant({ id: "client-2", deviceId: "device-2" }),
                        ],
                    },
                    breakout: { ...breakoutSliceInitialState, assignments: { "device-existing": "a" } },
                },
                withSignalConnection: true,
            });

            expect(() =>
                store.dispatch(doAssignBreakoutParticipants({ assignments: { "client-1": "a", "client-2": "b" } })),
            ).not.toThrow();

            expect(mockSignalEmit).toHaveBeenCalledWith("update_breakout_session", {
                assignments: { "device-existing": "a", "device-1": "a", "device-2": "b" },
            });
        });

        it("should not emit when not authorized", () => {
            const store = createStore({
                initialState: { authorization: { roomKey: null, roleName: "visitor" } },
                withSignalConnection: true,
            });

            expect(() => store.dispatch(doAssignBreakoutParticipants({ assignments: { "client-1": "a" } }))).toThrow(
                `Not authorized to perform this action`,
            );

            expect(mockSignalEmit).not.toHaveBeenCalled();
        });
    });

    describe("doAssignAllBreakoutParticipants", () => {
        it("should distribute all remote participants across the groups", () => {
            const store = createStore({
                initialState: {
                    authorization: { roomKey: null, roleName: "host" },
                    remoteParticipants: {
                        remoteParticipants: [
                            randomRemoteParticipant({ id: "client-1", deviceId: "device-1" }),
                            randomRemoteParticipant({ id: "client-2", deviceId: "device-2" }),
                        ],
                    },
                    breakout: { ...breakoutSliceInitialState, groups: { a: "Group A", b: "Group B" } },
                },
                withSignalConnection: true,
            });

            store.dispatch(doAssignAllBreakoutParticipants());

            expect(mockSignalEmit).toHaveBeenCalledTimes(1);
            const [, payload] = mockSignalEmit.mock.calls[0];
            const assignments = payload.assignments as { [deviceId: string]: string };
            expect(Object.keys(assignments).sort()).toEqual(["device-1", "device-2"]);
            Object.values(assignments).forEach((groupId) => expect(["a", "b"]).toContain(groupId));
        });
    });

    describe("doUnassignAllBreakoutParticipants", () => {
        it("should clear all assignments", () => {
            const store = createStore({
                initialState: {
                    authorization: { roomKey: null, roleName: "host" },
                    breakout: { ...breakoutSliceInitialState, assignments: { "device-1": "a", "device-2": "b" } },
                },
                withSignalConnection: true,
            });

            store.dispatch(doUnassignAllBreakoutParticipants());

            expect(mockSignalEmit).toHaveBeenCalledWith("update_breakout_session", {
                assignments: { "device-1": "", "device-2": "" },
            });
        });
    });

    describe("doShuffleBreakoutParticipants", () => {
        it("should redistribute the currently-assigned participants", () => {
            const store = createStore({
                initialState: {
                    authorization: { roomKey: null, roleName: "host" },
                    breakout: {
                        ...breakoutSliceInitialState,
                        groups: { a: "Group A", b: "Group B" },
                        assignments: { "device-1": "a", "device-2": "a", "device-3": "" },
                    },
                },
                withSignalConnection: true,
            });

            store.dispatch(doShuffleBreakoutParticipants());

            const [, payload] = mockSignalEmit.mock.calls[0];
            const assignments = payload.assignments as { [deviceId: string]: string };
            // Only previously-assigned (non-empty) devices are shuffled.
            expect(Object.keys(assignments).sort()).toEqual(["device-1", "device-2"]);
            Object.values(assignments).forEach((groupId) => expect(["a", "b"]).toContain(groupId));
        });
    });

    describe("doExtendBreakoutTimer", () => {
        it("should emit the increased duration", () => {
            const store = createStore({
                initialState: {
                    authorization: { roomKey: null, roleName: "host" },
                    breakout: { ...breakoutSliceInitialState, breakoutTimerDuration: 300 },
                },
                withSignalConnection: true,
            });

            store.dispatch(doExtendBreakoutTimer({ seconds: 120 }));

            expect(mockSignalEmit).toHaveBeenCalledWith("update_breakout_session", { breakoutTimerDuration: 420 });
        });
    });

    describe("doStopBreakoutTimer", () => {
        it("should disable the timer setting", () => {
            const store = createStore({
                initialState: { authorization: { roomKey: null, roleName: "host" } },
                withSignalConnection: true,
            });

            store.dispatch(doStopBreakoutTimer());

            expect(mockSignalEmit).toHaveBeenCalledWith("update_breakout_session", { breakoutTimerSetting: false });
        });
    });
});

describe("breakout group helpers", () => {
    it("defaultBreakoutGroupName", () => {
        expect(defaultBreakoutGroupName("a")).toBe("Group A");
    });

    it("createBreakoutGroups clamps to the 2-20 range and uses default names", () => {
        expect(createBreakoutGroups(3)).toEqual({ a: "Group A", b: "Group B", c: "Group C" });
        expect(Object.keys(createBreakoutGroups(1))).toHaveLength(2);
        expect(Object.keys(createBreakoutGroups(50))).toHaveLength(20);
    });
});
