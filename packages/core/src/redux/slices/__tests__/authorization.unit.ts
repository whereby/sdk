import {
    authorizationSlice,
    selectIsAuthorizedToLockRoom,
    selectIsAuthorizedToRequestAudioEnable,
} from "../authorization";

describe("authorizationSlice", () => {
    describe("reducers", () => {
        it("setRoomKey", () => {
            const result = authorizationSlice.reducer(undefined, authorizationSlice.actions.setRoomKey("roomKey"));

            expect(result.roomKey).toEqual("roomKey");
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
