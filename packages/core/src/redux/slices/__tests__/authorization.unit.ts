import {
    authorizationSlice,
    selectIsAuthorizedToLockRoom,
    selectIsAuthorizedToKickClient,
    selectIsAuthorizedToEndMeeting,
    selectIsAuthorizedToRequestAudioEnable,
} from "../authorization";
import { signalEvents } from "../signalConnection/actions";
import { doAppConfigure } from "../app";

describe("authorizationSlice", () => {
    describe("reducers", () => {
        it("setRoomKey", () => {
            const result = authorizationSlice.reducer(undefined, authorizationSlice.actions.setRoomKey("roomKey"));

            expect(result.roomKey).toEqual("roomKey");
        });

        it("doAppConfigure", () => {
            const result = authorizationSlice.reducer(
                undefined,
                doAppConfigure({
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    externalId: "externalId",
                }),
            );
            expect(result.roomKey).toEqual("roomKey");
        });

        it("signalEvents.roomJoined", () => {
            const result = authorizationSlice.reducer(
                undefined,
                signalEvents.roomJoined({
                    selfId: "selfId",
                    clientClaim: "clientClaim",
                    isLocked: false,
                    room: {
                        clients: [
                            {
                                displayName: "displayName",
                                id: "selfId",
                                streams: [],
                                isAudioEnabled: true,
                                isVideoEnabled: true,
                                role: {
                                    roleName: "host",
                                },
                                startedCloudRecordingAt: null,
                                externalId: null,
                            },
                        ],
                        knockers: [],
                        session: null,
                    },
                }),
            );
            expect(result.roleName).toEqual("host");
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
    });
});
