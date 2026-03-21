import { randomString } from "../../../__mocks__/appMocks";
import { liveTranscriptionSlice, initialLiveTranscriptionState } from "../liveTranscription";
import { signalEvents } from "../signalConnection/actions";

describe("liveTranscriptionSlice", () => {
    describe("reducers", () => {
        // We only handle error in this event. We start cloud recording when a new recorder client joins.
        it("signalEvents.liveTranscriptionStarted", () => {
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

        describe("signalEvents.liveTranscriptionStopped", () => {
            it("resets the recording state", () => {
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

        it("signalEvents.newClient", () => {
            const result = liveTranscriptionSlice.reducer(
                undefined,
                signalEvents.newClient({
                    client: {
                        displayName: "captioner",
                        deviceId: "deviceId",
                        streams: [],
                        isAudioEnabled: true,
                        isVideoEnabled: false,
                        breakoutGroup: null,
                        id: "id",
                        role: {
                            roleName: "captioner",
                        },
                        startedCloudRecordingAt: null,
                        startedLiveTranscriptionAt: "2021-01-01T00:00:00.000Z",
                        externalId: null,
                        isDialIn: false,
                        isAudioRecorder: false,
                    },
                }),
            );

            expect(result).toEqual({
                isInitiator: false,
                isTranscribing: true,
                status: "transcribing",
                startedAt: 1609459200000,
            });
        });
    });
});
