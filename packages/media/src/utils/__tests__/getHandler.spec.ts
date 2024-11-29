import { getHandler } from "../getHandler";

jest.mock("mediasoup-client");
const mediasoupClient = jest.requireMock("mediasoup-client");

describe("getHandler", () => {
    (global as any).userAgent = jest.spyOn(navigator, "userAgent", "get");

    it("returns the resolved handler from mediasoup-client", () => {
        mediasoupClient.detectDevice.mockImplementationOnce(() => "Chrome111");

        expect(getHandler()).toEqual("Chrome111");
    });

    describe("when the safari version is 17", () => {
        it("returns Safari17", () => {
            (global as any).userAgent.mockReturnValue(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) \
AppleWebKit/605.1.15 (KHTML, like Gecko) \
Version/17.4 Safari/605.1.15"
            );

            expect(getHandler()).toEqual("Safari17");
        });
    });

    describe("when the safari version is 18", () => {
        it("returns Safari17", () => {
            (global as any).userAgent.mockReturnValue(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) \
AppleWebKit/605.1.15 (KHTML, like Gecko) \
Version/18.1.1 Safari/605.1.15"
            );

            expect(getHandler()).toEqual("Safari17");
        });
    });
});
