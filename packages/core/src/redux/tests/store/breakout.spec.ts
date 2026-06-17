import { createStore, mockSignalEmit } from "../store.setup";
import { randomRemoteParticipant } from "../../../__mocks__/appMocks";
import {
    doBreakoutJoin,
    doStartBreakoutSession,
    doUpdateBreakoutSession,
    doStopBreakoutSession,
    doAssignBreakoutParticipants,
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
});
