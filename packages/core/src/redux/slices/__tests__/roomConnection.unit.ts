import { oneOf } from "../../../__mocks__/appMocks";
import { roomConnectionSlice, selectShouldConnectRoom } from "../roomConnection";
import { signalEvents } from "../signalConnection/actions";

describe("roomConnectionSlice", () => {
    describe("reducers", () => {
        describe("signalEvents.roomJoined", () => {
            it("should set status to room_locked if the room is locked", () => {
                const result = roomConnectionSlice.reducer(
                    undefined,
                    signalEvents.roomJoined({
                        error: "room_locked",
                        selfId: "selfId",
                        clientClaim: "clientClaim",
                        isLocked: true,
                    }),
                );

                expect(result).toEqual({
                    status: "room_locked",
                    session: null,
                    error: null,
                });
            });

            it("should set status to connected if the room is not locked", () => {
                const result = roomConnectionSlice.reducer(
                    undefined,
                    signalEvents.roomJoined({
                        selfId: "selfId",
                        clientClaim: "clientClaim",
                        isLocked: false,
                    }),
                );

                expect(result).toEqual({
                    status: "connected",
                    session: null,
                    error: null,
                });
            });

            it("should set status to disconnected and populate the error if the there is an error", () => {
                const result = roomConnectionSlice.reducer(
                    undefined,
                    signalEvents.roomJoined({
                        error: "room_full",
                        selfId: "selfId",
                        isLocked: false,
                    }),
                );

                expect(result).toEqual({
                    status: "disconnected",
                    session: null,
                    error: "room_full",
                });
            });
        });

        describe("signalEvents.clientKicked", () => {
            it("should set status to kicked if the client is kicked", () => {
                const result = roomConnectionSlice.reducer(
                    undefined,
                    signalEvents.clientKicked({
                        clientId: "abcd-1234",
                    }),
                );

                expect(result).toEqual({
                    status: "kicked",
                    session: null,
                    error: null,
                });
            });
        });

        describe("signalEvents.disconnect", () => {
            it("should set status to disconnected", () => {
                const result = roomConnectionSlice.reducer(undefined, signalEvents.disconnect());

                expect(result).toEqual({
                    status: "disconnected",
                    session: null,
                    error: null,
                });
            });
        });
    });

    describe("reactors", () => {
        describe("selectShouldConnectRoom", () => {
            const x = () => oneOf(true, false);

            it.each`
                appIsActive | organizationId | roomConnectionStatus | signalIdentified | localMediaStatus | expected
                ${true}     | ${undefined}   | ${"ready"}           | ${x()}           | ${"started"}     | ${false}
                ${true}     | ${"orgId"}     | ${"ready"}           | ${true}          | ${"started"}     | ${true}
                ${true}     | ${"orgId"}     | ${"connected"}       | ${x()}           | ${"started"}     | ${false}
                ${true}     | ${"orgId"}     | ${"ready"}           | ${false}         | ${"starting"}    | ${false}
                ${true}     | ${"orgId"}     | ${"ready"}           | ${x()}           | ${"error"}       | ${false}
            `(
                "Should return $expected when appIsActive=$appIsActive, organizationId=$organizationId, roomConnectionStatus=$roomConnectionStatus, signalIdentified=$signalIdentified, localMediaStatus=$localMediaStatus",
                ({
                    appIsActive,
                    organizationId,
                    roomConnectionStatus,
                    signalIdentified,
                    localMediaStatus,
                    expected,
                }) => {
                    expect(
                        selectShouldConnectRoom.resultFunc(
                            appIsActive,
                            organizationId,
                            roomConnectionStatus,
                            signalIdentified,
                            localMediaStatus,
                        ),
                    ).toEqual(expected);
                },
            );
        });
    });
});
