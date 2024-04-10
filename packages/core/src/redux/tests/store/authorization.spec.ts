import { createStore, mockSignalEmit } from "../store.setup";
import { randomLocalParticipant } from "../../../__mocks__/appMocks";
import { doLockRoom } from "../../slices/authorization";

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

                expect(mockSignalEmit).not.toHaveBeenCalledWith("set_lock", { locked: true });
            });
        });
    });
});
