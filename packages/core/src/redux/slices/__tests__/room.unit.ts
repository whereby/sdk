import { roomSlice } from "../room";
import { doAppJoin } from "../app";
import { signalEvents } from "../signalConnection/actions";

describe("roomSlice", () => {
    describe("reducers", () => {
        it("setRoomKey", () => {
            const result = roomSlice.reducer(undefined, roomSlice.actions.setRoomKey("roomKey"));

            expect(result.roomKey).toEqual("roomKey");
        });

        it("doAppJoin", () => {
            const result = roomSlice.reducer(
                undefined,
                doAppJoin({
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    externalId: "externalId",
                }),
            );
            expect(result.roomKey).toEqual("roomKey");
        });

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
