import { cloudRecordingSlice, initialCloudRecordingState } from "../cloudRecording";
import { signalEvents } from "../signalConnection/actions";

describe("cloudRecordingSlice", () => {
    describe("reducers", () => {
        // We only handle error in this event. We start cloud recording when a new recorder client joins.
        it("signalEvents.cloudRecordingStarted", () => {
            const result = cloudRecordingSlice.reducer(
                undefined,
                signalEvents.cloudRecordingStarted({ error: "some error" }),
            );

            expect(result).toEqual({
                error: "some error",
                isInitiator: false,
                isRecording: false,
                status: "error",
            });
        });

        describe("signalEvents.cloudRecordingStopped", () => {
            it("resets the recording state", () => {
                const result = cloudRecordingSlice.reducer(undefined, signalEvents.cloudRecordingStopped());

                expect(result).toEqual({
                    error: null,
                    isInitiator: false,
                    isRecording: false,
                });
            });

            it("resets the recording state as the initiator", () => {
                const result = cloudRecordingSlice.reducer(
                    { ...initialCloudRecordingState, isInitiator: true },
                    signalEvents.cloudRecordingStopped(),
                );

                expect(result).toEqual({
                    error: null,
                    isInitiator: false,
                    isRecording: false,
                });
            });
        });

        it("signalEvents.newClient", () => {
            const result = cloudRecordingSlice.reducer(
                undefined,
                signalEvents.newClient({
                    client: {
                        displayName: "recorder",
                        deviceId: "deviceId",
                        streams: [],
                        isAudioEnabled: true,
                        isVideoEnabled: false,
                        breakoutGroup: null,
                        id: "id",
                        role: {
                            roleName: "recorder",
                        },
                        startedCloudRecordingAt: "2021-01-01T00:00:00.000Z",
                        externalId: null,
                        isDialIn: false,
                        isAudioRecorder: false,
                    },
                }),
            );

            expect(result).toEqual({
                error: null,
                isInitiator: false,
                isRecording: true,
                status: "recording",
                startedAt: 1609459200000,
            });
        });
    });
});
