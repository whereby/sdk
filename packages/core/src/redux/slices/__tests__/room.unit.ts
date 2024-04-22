import { roomSlice } from "../room";
import { signalEvents } from "../signalConnection/actions";

describe("roomSlice", () => {
    describe("reducers", () => {
        it("signalEvents.roomJoined", () => {
            const result = roomSlice.reducer(
                undefined,
                signalEvents.roomJoined({
                    selfId: "selfId",
                    clientClaim: "clientClaim",
                    isLocked: true,
                }),
            );
            expect(result.isLocked).toEqual(true);
        });

        it("signalEvents.roomLocked", () => {
            const result = roomSlice.reducer(
                undefined,
                signalEvents.roomLocked({
                    isLocked: true,
                }),
            );
            expect(result.isLocked).toEqual(true);
        });
    });
});
