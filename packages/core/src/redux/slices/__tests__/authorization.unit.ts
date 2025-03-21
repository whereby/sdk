import {
    authorizationSlice,
    authorizationSliceInitialState,
    selectIsAuthorizedToLockRoom,
    selectIsAuthorizedToKickClient,
    selectIsAuthorizedToEndMeeting,
    selectIsAuthorizedToRequestAudioEnable,
} from "../authorization";
import { signalEvents } from "../signalConnection/actions";
import { doAppStart } from "../app";

describe("authorizationSlice", () => {
    describe("reducers", () => {
        it("setRoomKey", () => {
            const result = authorizationSlice.reducer(undefined, authorizationSlice.actions.setRoomKey("roomKey"));

            expect(result.roomKey).toEqual("roomKey");
        });

        it("doAppStart", () => {
            const result = authorizationSlice.reducer(
                undefined,
                doAppStart({
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    externalId: "externalId",
                }),
            );
            expect(result.roomKey).toEqual("roomKey");
        });

        describe("signalEvents.roomJoined", () => {
            describe("on error", () => {
                it("should return default state", () => {
                    const result = authorizationSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            error: "some_error",
                        }),
                    );
                    expect(result).toEqual(authorizationSliceInitialState);
                });
            });

            describe("on success", () => {
                it("should update state", () => {
                    const result = authorizationSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            selfId: "selfId",
                            breakoutGroup: null,
                            clientClaim: "clientClaim",
                            isLocked: false,
                            room: {
                                clients: [
                                    {
                                        displayName: "displayName",
                                        id: "selfId",
                                        deviceId: "deviceId",
                                        streams: [],
                                        isAudioEnabled: true,
                                        isVideoEnabled: true,
                                        breakoutGroup: null,
                                        role: {
                                            roleName: "host",
                                        },
                                        startedCloudRecordingAt: null,
                                        externalId: null,
                                        isDialIn: false,
                                    },
                                ],
                                knockers: [],
                                spotlights: [],
                                session: null,
                            },
                        }),
                    );
                    expect(result.roleName).toEqual("host");
                });
            });
        });
    });

    describe("selectors", () => {
        describe("selectIsAuthorizedToLockRoom", () => {
            it.each`
                localParticipantRole | expectedResult
                ${"visitor"}         | ${false}
                ${"host"}            | ${true}
            `(
                "should return $expectedResult when localParticipantRole=$localParticipantRole",
                ({ localParticipantRole, expectedResult }) => {
                    expect(selectIsAuthorizedToLockRoom.resultFunc(localParticipantRole)).toEqual(expectedResult);
                },
            );
        });

        describe("selectIsAuthorizedToKickClient", () => {
            it.each`
                localParticipantRole | expectedResult
                ${"visitor"}         | ${false}
                ${"host"}            | ${true}
            `(
                "should return $expectedResult when localParticipantRole=$localParticipantRole",
                ({ localParticipantRole, expectedResult }) => {
                    expect(selectIsAuthorizedToKickClient.resultFunc(localParticipantRole)).toEqual(expectedResult);
                },
            );
        });

        describe("selectIsAuthorizedToEndMeeting", () => {
            it.each`
                localParticipantRole | expectedResult
                ${"visitor"}         | ${false}
                ${"host"}            | ${true}
            `(
                "should return $expectedResult when localParticipantRole=$localParticipantRole",
                ({ localParticipantRole, expectedResult }) => {
                    expect(selectIsAuthorizedToEndMeeting.resultFunc(localParticipantRole)).toEqual(expectedResult);
                },
            );
        });

        describe("selectIsAuthorizedToRequestAudioEnable", () => {
            it.each`
                localParticipantRole | expectedResult
                ${"visitor"}         | ${false}
                ${"host"}            | ${true}
            `(
                "should return $expectedResult when localParticipantRole=$localParticipantRole",
                ({ localParticipantRole, expectedResult }) => {
                    expect(selectIsAuthorizedToRequestAudioEnable.resultFunc(localParticipantRole)).toEqual(
                        expectedResult,
                    );
                },
            );
        });

        describe("selectIsAuthorizedToRequestVideoEnable", () => {
            it.each`
                localParticipantRole | expectedResult
                ${"visitor"}         | ${false}
                ${"host"}            | ${true}
            `(
                "should return $expectedResult when localParticipantRole=$localParticipantRole",
                ({ localParticipantRole, expectedResult }) => {
                    expect(selectIsAuthorizedToRequestAudioEnable.resultFunc(localParticipantRole)).toEqual(
                        expectedResult,
                    );
                },
            );
        });
    });
});
