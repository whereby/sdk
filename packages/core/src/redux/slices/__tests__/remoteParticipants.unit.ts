import { remoteParticipantsSlice } from "../remoteParticipants";
import { signalEvents } from "../signalConnection/actions";
import { rtcEvents } from "../rtcConnection/actions";
import {
    randomSignalClient,
    randomRemoteParticipant,
    randomString,
    randomMediaStream,
} from "../../../__mocks__/appMocks";

describe("remoteParticipantsSlice", () => {
    describe("reducers", () => {
        describe("signalEvents.roomJoined", () => {
            it("should update state", () => {
                const result = remoteParticipantsSlice.reducer(
                    undefined,
                    signalEvents.roomJoined({
                        isLocked: false,
                        selfId: "selfId",
                        clientClaim: "clientClaim",
                        room: {
                            clients: [
                                {
                                    displayName: "displayName",
                                    id: "id",
                                    streams: [],
                                    isAudioEnabled: true,
                                    isVideoEnabled: true,
                                    role: {
                                        roleName: "visitor",
                                    },
                                    startedCloudRecordingAt: null,
                                    externalId: null,
                                },
                            ],
                            knockers: [],
                            spotlights: [],
                            session: null,
                        },
                    }),
                );

                expect(result.remoteParticipants).toEqual([
                    {
                        displayName: "displayName",
                        id: "id",
                        streams: [],
                        isAudioEnabled: true,
                        isVideoEnabled: true,
                        isLocalParticipant: false,
                        stream: null,
                        newJoiner: false,
                        roleName: "visitor",
                        startedCloudRecordingAt: null,
                        presentationStream: null,
                        externalId: null,
                    },
                ]);
            });
        });

        it("signalEvents.newClient", () => {
            const client = randomSignalClient();

            const result = remoteParticipantsSlice.reducer(
                undefined,
                signalEvents.newClient({
                    client,
                }),
            );

            expect(result.remoteParticipants).toEqual([
                {
                    id: client.id,
                    displayName: client.displayName,
                    isAudioEnabled: client.isAudioEnabled,
                    isVideoEnabled: client.isVideoEnabled,
                    isLocalParticipant: false,
                    stream: null,
                    streams: [],
                    newJoiner: true,
                    roleName: client.role.roleName,
                    startedCloudRecordingAt: client.startedCloudRecordingAt,
                    presentationStream: null,
                    externalId: null,
                },
            ]);
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
