import { oneOf, randomSignalClient } from "../../../__mocks__/appMocks";
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

        describe("room session", () => {
            const session = { id: "session-1", createdAt: "2026-10-27T12:00:00.000Z" };
            const roomJoinedWithSession = (roomSession: typeof session | null) =>
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
                        session: roomSession,
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
                });

            it("should set the session when a client joins a room that was empty", () => {
                const joined = roomConnectionSlice.reducer(undefined, roomJoinedWithSession(null));
                const result = roomConnectionSlice.reducer(
                    joined,
                    signalEvents.newClient({ client: randomSignalClient(), room: { session } }),
                );

                expect(result.session).toEqual(session);
            });

            it("should set the session when a knocker is admitted", () => {
                const locked = roomConnectionSlice.reducer(
                    undefined,
                    signalEvents.roomJoined({
                        error: "room_locked",
                        selfId: "selfId",
                        isClaimed: true,
                        isLocked: true,
                    }),
                );
                const result = roomConnectionSlice.reducer(locked, roomJoinedWithSession(session));

                expect(result.session).toEqual(session);
            });

            it("should keep the session when new_client has no room", () => {
                const result = roomConnectionSlice.reducer(
                    { ...roomConnectionSliceInitialState, session },
                    signalEvents.newClient({ client: randomSignalClient() }),
                );

                expect(result.session).toEqual(session);
            });

            it("should keep the session when a different session ends", () => {
                const result = roomConnectionSlice.reducer(
                    { ...roomConnectionSliceInitialState, session },
                    signalEvents.roomSessionEnded({ roomSessionId: "session-0" }),
                );

                expect(result.session).toEqual(session);
            });

            it("should clear the session when it ends", () => {
                const result = roomConnectionSlice.reducer(
                    { ...roomConnectionSliceInitialState, session },
                    signalEvents.roomSessionEnded({ roomSessionId: session.id }),
                );

                expect(result.session).toEqual(null);
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
