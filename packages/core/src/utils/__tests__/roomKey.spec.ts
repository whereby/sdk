import parseUnverifiedRoomKeyData from "../roomKey";

describe("roomKey", () => {
    describe("parseUnverifiedRoomKeyData", () => {
        it.each`
            roomKey                                                               | expectedResult
            ${""}                                                                 | ${{}}
            ${"not_a_jwt_token"}                                                  | ${{}}
            ${"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid_data.unsigned"}       | ${{}}
            ${"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZXN0Ijp0cnVlfQ.unsigned"} | ${{ test: true }}
        `("should return $expectedResult when roomKey:$roomKey", ({ roomKey, expectedResult }) => {
            const result = parseUnverifiedRoomKeyData(roomKey);

            expect(result).toEqual(expectedResult);
        });
    });
});
