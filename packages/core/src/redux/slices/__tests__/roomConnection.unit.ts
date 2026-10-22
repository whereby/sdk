import { oneOf } from "../../../__mocks__/appMocks";
import { roomConnectionSlice, roomConnectionSliceInitialState, selectShouldConnectRoom } from "../roomConnection";
import { signalEvents } from "../signalConnection/actions";

describe("roomConnectionSlice", () => {
    describe("reducers", () => {
        describe("signalEvents.roomJoined", () => {
            describe("on error", () => {
                it("should set status to room_locked if the room is locked", () => {
                    const result = roomConnectionSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            error: "room_locked",
                            selfId: "selfId",
                            isClaimed: true,
                            isLocked: true,
                        }),
                    );

                    expect(result).toEqual({
                        status: "room_locked",
                        session: null,
                        error: null,
                        knockResponse: null,
                        isRejoining: false,
                    });
                });

                it("should set status to disconnected and populate the error if error is not room_locked", () => {
                    const result = roomConnectionSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            error: "room_full",
                            isClaimed: true,
                        }),
                    );

                    expect(result).toEqual({
                        status: "disconnected",
                        session: null,
                        error: "room_full",
                        knockResponse: null,
                        isRejoining: false,
                    });
                });
            });

            describe("on success", () => {
                it("should set status to connected if the room is not locked", () => {
                    const result = roomConnectionSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            selfId: "selfId",
                            breakoutGroup: "",
                            clientClaim: "clientClaim",
                            eventClaim: "",
                            room: {
                                mode: "group",
                                clients: [],
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
                        }),
                    );

                    expect(result).toEqual({
                        status: "connected",
                        session: null,
                        error: null,
                        knockResponse: null,
                        isRejoining: false,
                    });
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
                    knockResponse: null,
                    isRejoining: false,
                });
            });
        });

        describe("signalEvents.disconnect", () => {
            it("should set status to reconnecting when the socket will reconnect", () => {
                const result = roomConnectionSlice.reducer(
                    { ...roomConnectionSliceInitialState, status: "connected" },
                    signalEvents.disconnect({ willReconnect: true }),
                );

                expect(result).toEqual({
                    ...roomConnectionSliceInitialState,
                    status: "reconnecting",
                    isRejoining: true,
                });
            });

            it("should set status to disconnected when the socket won't reconnect", () => {
                const result = roomConnectionSlice.reducer(
                    { ...roomConnectionSliceInitialState, status: "connected" },
                    signalEvents.disconnect({ willReconnect: false }),
                );

                expect(result.status).toEqual("disconnected");
                expect(result.isRejoining).toEqual(false);
            });

            it("should stop rejoining when the socket won't reconnect", () => {
                const result = roomConnectionSlice.reducer(
                    { ...roomConnectionSliceInitialState, status: "connecting", isRejoining: true },
                    signalEvents.disconnect({ willReconnect: false }),
                );

                expect(result.status).toEqual("disconnected");
                expect(result.isRejoining).toEqual(false);
            });

            it("should keep rejoining if the connection drops again before the room is rejoined", () => {
                const result = roomConnectionSlice.reducer(
                    { ...roomConnectionSliceInitialState, status: "connecting", isRejoining: true },
                    signalEvents.disconnect({ willReconnect: true }),
                );

                expect(result.isRejoining).toEqual(true);
            });

            it("should not rejoin if the room was not joined", () => {
                const result = roomConnectionSlice.reducer(
                    { ...roomConnectionSliceInitialState, status: "connecting" },
                    signalEvents.disconnect({ willReconnect: true }),
                );

                expect(result.isRejoining).toEqual(false);
            });

            it.each(["kicked", "left"] as const)("should keep status %s", (status) => {
                const result = roomConnectionSlice.reducer(
                    { ...roomConnectionSliceInitialState, status },
                    signalEvents.disconnect({ willReconnect: false }),
                );

                expect(result.status).toEqual(status);
            });
        });

        describe("signalEvents.roomJoined after a disconnect", () => {
            const rejoiningState = {
                ...roomConnectionSliceInitialState,
                status: "connecting" as const,
                isRejoining: true,
            };

            it("should stop rejoining on success", () => {
                const result = roomConnectionSlice.reducer(
                    rejoiningState,
                    signalEvents.roomJoined({
                        selfId: "selfId",
                        breakoutGroup: "",
                        clientClaim: "clientClaim",
                        eventClaim: "",
                        room: {
                            mode: "group",
                            clients: [],
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
                    }),
                );

                expect(result).toEqual({ ...roomConnectionSliceInitialState, status: "connected" });
            });

            it("should stop rejoining on error", () => {
                const result = roomConnectionSlice.reducer(
                    rejoiningState,
                    signalEvents.roomJoined({ error: "room_full", isClaimed: true }),
                );

                expect(result.status).toEqual("disconnected");
                expect(result.error).toEqual("room_full");
                expect(result.isRejoining).toEqual(false);
            });
        });
    });

    describe("reactors", () => {
        describe("selectShouldConnectRoom", () => {
            const x = () => oneOf(true, false);

            it.each`
                appIsActive | organizationId | roomConnectionStatus | signalIdentified | localMediaStatus | roomConnectionError | expected
                ${true}     | ${undefined}   | ${"ready"}           | ${x()}           | ${"started"}     | ${null}             | ${false}
                ${true}     | ${"orgId"}     | ${"ready"}           | ${true}          | ${"started"}     | ${null}             | ${true}
                ${true}     | ${"orgId"}     | ${"connected"}       | ${x()}           | ${"started"}     | ${null}             | ${false}
                ${true}     | ${"orgId"}     | ${"ready"}           | ${false}         | ${"starting"}    | ${null}             | ${false}
                ${true}     | ${"orgId"}     | ${"ready"}           | ${x()}           | ${"error"}       | ${null}             | ${false}
                ${true}     | ${"orgId"}     | ${"ready"}           | ${true}          | ${"started"}     | ${"room_full"}      | ${false}
            `(
                "Should return $expected when appIsActive=$appIsActive, organizationId=$organizationId, roomConnectionStatus=$roomConnectionStatus, signalIdentified=$signalIdentified, localMediaStatus=$localMediaStatus, roomConnectionError=$roomConnectionError",
                ({
                    appIsActive,
                    organizationId,
                    roomConnectionStatus,
                    signalIdentified,
                    localMediaStatus,
                    roomConnectionError,
                    expected,
                }) => {
                    expect(
                        selectShouldConnectRoom.resultFunc(
                            appIsActive,
                            organizationId,
                            roomConnectionStatus,
                            signalIdentified,
                            localMediaStatus,
                            roomConnectionError,
                        ),
                    ).toEqual(expected);
                },
            );
        });
    });
});
