import { randomString } from "../../../__mocks__/appMocks";
import { liveTranscriptionSlice, initialLiveTranscriptionState } from "../liveTranscription";
import { signalEvents } from "../signalConnection/actions";

describe("liveTranscriptionSlice", () => {
    describe("reducers", () => {
        describe("signalEvents.liveTranscriptionStarted", () => {
            describe("if initiation succeeds", () => {
                it("sets the status to 'transcribing'", () => {
                    const result = liveTranscriptionSlice.reducer(undefined, signalEvents.liveTranscriptionStarted({}));

                    expect(result).toEqual({
                        ...initialLiveTranscriptionState,
                        isTranscribing: true,
                        status: "transcribing",
                        startedAt: expect.any(Number),
                    });
                });
            });

            describe("if an error occurs during initiation", () => {
                it("sets the status to 'error'", () => {
                    const result = liveTranscriptionSlice.reducer(
                        undefined,
                        signalEvents.liveTranscriptionStarted({ error: "some error" }),
                    );

                    expect(result).toEqual({
                        error: "some error",
                        isInitiator: false,
                        isTranscribing: false,
                        status: "error",
                    });
                });
            });
        });

        describe("signalEvents.liveTranscriptionStopped", () => {
            it("resets the status to undefined", () => {
                const result = liveTranscriptionSlice.reducer(
                    undefined,
                    signalEvents.liveTranscriptionStopped({
                        transcriptionId: randomString(),
                        endedAt: "2021-01-01T00:00:00.000Z",
                    }),
                );

                expect(result).toEqual({
                    isInitiator: false,
                    isTranscribing: false,
                    startedAt: undefined,
                    status: undefined,
                });
            });

            it("resets the recording state as the initiator", () => {
                const result = liveTranscriptionSlice.reducer(
                    { ...initialLiveTranscriptionState, isInitiator: true },
                    signalEvents.liveTranscriptionStopped({
                        transcriptionId: randomString(),
                        endedAt: "2021-01-01T00:00:00.000Z",
                    }),
                );

                expect(result).toEqual({
                    isInitiator: false,
                    isTranscribing: false,
                    startedAt: undefined,
                    status: undefined,
                });
            });
        });

        describe("signalEvents.roomJoined", () => {
            describe("when room.liveTranscriptionId is present", () => {
                it("should set status to 'transcribing'", () => {
                    const result = liveTranscriptionSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            selfId: "selfId",
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
                                liveTranscriptionId: "liveTranscriptionId",
                            },
                        }),
                    );

                    expect(result).toEqual({
                        isInitiator: false,
                        isTranscribing: true,
                        status: "transcribing",
                        startedAt: expect.any(Number),
                    });
                });
            });

            describe("when room.liveTranscriptionId is missing", () => {
                it("should not update status", () => {
                    const result = liveTranscriptionSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            selfId: "selfId",
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
                                liveTranscriptionId: undefined,
                            },
                        }),
                    );

                    expect(result).toEqual(initialLiveTranscriptionState);
                });
            });
        });
    });
});
