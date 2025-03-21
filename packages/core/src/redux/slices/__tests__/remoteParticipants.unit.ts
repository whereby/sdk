import {
    remoteParticipantsSlice,
    remoteParticipantsSliceInitialState,
    createRemoteParticipant,
} from "../remoteParticipants";
import { signalEvents } from "../signalConnection/actions";
import { rtcEvents } from "../rtcConnection/actions";
import {
    randomSignalClient,
    randomLocalParticipant,
    randomRemoteParticipant,
    randomString,
    randomMediaStream,
} from "../../../__mocks__/appMocks";

describe("remoteParticipantsSlice", () => {
    describe("reducers", () => {
        describe("signalEvents.roomJoined", () => {
            describe("on error", () => {
                it("should return default state", () => {
                    const result = remoteParticipantsSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            error: "some_error",
                        }),
                    );
                    expect(result).toEqual(remoteParticipantsSliceInitialState);
                });
            });

            describe("on success", () => {
                it("should update state", () => {
                    const localClient = randomSignalClient();
                    const localParticipant = randomLocalParticipant({
                        id: localClient.id,
                    });

                    const remoteClient = randomSignalClient({ breakoutGroup: "b" });
                    const remoteParticipant = createRemoteParticipant(remoteClient);

                    const result = remoteParticipantsSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            ...localParticipant,
                            isLocked: false,
                            selfId: localClient.id,
                            room: {
                                clients: [localClient, remoteClient],
                                knockers: [],
                                spotlights: [],
                                session: null,
                            },
                        }),
                    );

                    expect(result.remoteParticipants).toEqual([remoteParticipant]);
                });
            });
        });

        it("signalEvents.newClient", () => {
            const client = randomSignalClient({ breakoutGroup: "a" });

            const result = remoteParticipantsSlice.reducer(
                undefined,
                signalEvents.newClient({
                    client,
                }),
            );

            expect(result.remoteParticipants).toEqual([createRemoteParticipant(client, true)]);
        });

        it("signalEvents.clientLeft", () => {
            const participant = randomRemoteParticipant();
            const state = {
                remoteParticipants: [participant],
            };

            const result = remoteParticipantsSlice.reducer(
                state,
                signalEvents.clientLeft({
                    clientId: participant.id,
                }),
            );

            expect(result.remoteParticipants).toEqual([]);
        });

        describe("signalEvents.audioEnabled", () => {
            it("should update the participant", () => {
                const isAudioEnabled = true;
                const participant = randomRemoteParticipant();
                const state = {
                    remoteParticipants: [participant],
                };

                const result = remoteParticipantsSlice.reducer(
                    state,
                    signalEvents.audioEnabled({
                        clientId: participant.id,
                        isAudioEnabled,
                    }),
                );

                expect(result.remoteParticipants).toEqual([
                    {
                        ...participant,
                        isAudioEnabled,
                    },
                ]);
            });
        });

        describe("signalEvents.clientMetadataReceived", () => {
            it("should update the participant when type is UserData", () => {
                const displayName = randomString();
                const participant = randomRemoteParticipant();
                const state = {
                    remoteParticipants: [participant],
                };

                const result = remoteParticipantsSlice.reducer(
                    state,
                    signalEvents.clientMetadataReceived({
                        type: "UserData",
                        payload: {
                            clientId: participant.id,
                            displayName,
                        },
                    }),
                );

                expect(result.remoteParticipants).toEqual([
                    {
                        ...participant,
                        displayName,
                    },
                ]);
            });

            it("should console.warn if a metadata error is returned", () => {
                jest.spyOn(global.console, "warn");

                const clientMetaDataError = "invalid_display_name";

                const participant = randomRemoteParticipant();
                const state = {
                    remoteParticipants: [participant],
                };

                const result = remoteParticipantsSlice.reducer(
                    state,
                    signalEvents.clientMetadataReceived({
                        error: clientMetaDataError,
                    }),
                );

                expect(global.console.warn).toHaveBeenCalledWith(clientMetaDataError);

                expect(result.remoteParticipants).toEqual([participant]);
            });
        });

        describe("signalEvents.videoEnabled", () => {
            it("should update the participant", () => {
                const isVideoEnabled = true;
                const participant = randomRemoteParticipant();
                const state = {
                    remoteParticipants: [participant],
                };

                const result = remoteParticipantsSlice.reducer(
                    state,
                    signalEvents.videoEnabled({
                        clientId: participant.id,
                        isVideoEnabled,
                    }),
                );

                expect(result.remoteParticipants).toEqual([
                    {
                        ...participant,
                        isVideoEnabled,
                    },
                ]);
            });
        });

        describe("signalEvents.breakoutGroupJoined", () => {
            it("should update the participant", () => {
                const breakoutGroupId = "test_breakout_group";
                const participant = randomRemoteParticipant();
                const state = {
                    remoteParticipants: [participant],
                };

                const result = remoteParticipantsSlice.reducer(
                    state,
                    signalEvents.breakoutGroupJoined({
                        clientId: participant.id,
                        group: breakoutGroupId,
                    }),
                );

                expect(result.remoteParticipants).toEqual([
                    {
                        ...participant,
                        breakoutGroup: breakoutGroupId,
                    },
                ]);
            });
        });

        describe("signalEvents.screenshareStarted", () => {
            it("should update the participant", () => {
                const participant = randomRemoteParticipant();
                const state = {
                    remoteParticipants: [participant],
                };

                const result = remoteParticipantsSlice.reducer(
                    state,
                    signalEvents.screenshareStarted({
                        clientId: participant.id,
                        streamId: "streamId",
                        hasAudioTrack: true,
                    }),
                );

                expect(result.remoteParticipants).toEqual([
                    {
                        ...participant,
                        presentationStream: null,
                        streams: [
                            {
                                id: "streamId",
                                state: "to_accept",
                            },
                        ],
                    },
                ]);
            });
        });

        describe("signalEvents.screenshareStopped", () => {
            it("should update the participant", () => {
                const participant = randomRemoteParticipant({ streams: [{ id: "streamId", state: "to_accept" }] });
                const state = {
                    remoteParticipants: [participant],
                };

                const result = remoteParticipantsSlice.reducer(
                    state,
                    signalEvents.screenshareStopped({
                        clientId: participant.id,
                        streamId: "streamId",
                    }),
                );

                expect(result.remoteParticipants).toEqual([
                    {
                        ...participant,
                        presentationStream: null,
                        streams: [],
                    },
                ]);
            });
        });

        describe("rtcEvents.streamAdded", () => {
            it("should update the participant", () => {
                const participant = randomRemoteParticipant();
                const stream = randomMediaStream();
                const state = {
                    remoteParticipants: [participant],
                };

                const result = remoteParticipantsSlice.reducer(
                    state,
                    rtcEvents.streamAdded({
                        clientId: participant.id,
                        streamId: "streamId",
                        stream,
                        streamType: "webcam",
                    }),
                );

                expect(result.remoteParticipants).toEqual([
                    {
                        ...participant,
                        stream,
                    },
                ]);
            });
        });
    });
});
