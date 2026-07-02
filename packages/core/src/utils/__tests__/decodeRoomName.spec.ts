import decodeRoomName from "../decodeRoomName";

describe(`decode path`, () => {
    it(`should return the roomName decoded`, () => {
        const result = decodeRoomName("/some%20roomname");
        expect(result).toEqual(`/some roomname`);
    });

    it(`should return null if roomName is null`, () => {
        const result = decodeRoomName(null);
        expect(result).toEqual(null);
    });

    it(`should return the original roomName if it cannot be decoded`, () => {
        const result = decodeRoomName("some%roomname");
        expect(result).toEqual(`some%roomname`);
    });
});
