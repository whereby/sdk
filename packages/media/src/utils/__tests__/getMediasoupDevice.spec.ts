import { getMediasoupDeviceAsync } from "../getMediasoupDevice";

jest.mock("mediasoup-client", () => ({
    Device: jest.fn(),
    detectDeviceAsync: jest.fn(),
}));
const mediasoupClient = jest.requireMock("mediasoup-client");

const safari17UserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const safari18UserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1.1 Safari/605.1.15";

describe("getMediasoupClient", () => {
    const features = {};
    (global as any).userAgent = jest.spyOn(navigator, "userAgent", "get");

    it("returns the resolved handler from mediasoup-client", async () => {
        mediasoupClient.detectDeviceAsync.mockImplementationOnce(() => "Chrome111");

        await getMediasoupDeviceAsync(features);

        expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerName: "Chrome111" });
    });

    describe("when the browser version is Safari12", () => {
        beforeEach(() => {
            mediasoupClient.detectDeviceAsync.mockImplementationOnce(() => "Safari12");
        });

        it("returns the resolved handler from mediasoup-client", async () => {
            await getMediasoupDeviceAsync(features);

            expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerName: "Safari12" });
        });

        describe.each([
            { version: 17, userAgent: safari17UserAgent },
            { version: 18, userAgent: safari18UserAgent },
        ])("when the user agent version is $version", ({ userAgent }) => {
            beforeEach(() => {
                (global as any).userAgent.mockReturnValue(userAgent);
            });

            it("returns the resolved handler from mediasoup-client", async () => {
                await getMediasoupDeviceAsync(features);

                expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerName: "Safari12" });
            });
        });
    });

    describe.each(["applecoremedia", "applewebkit", "safari"])("when the userAgent matches %s", (userAgent) => {
        beforeEach(() => {
            (global as any).userAgent.mockReturnValue(userAgent);
        });

        it("returns a Safari12 device", async () => {
            await getMediasoupDeviceAsync({ safari17HandlerOn: false });

            expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerName: "Safari12" });
        });
    });

    describe.each(["iphone", "ipad"])("when the userAgent matches %s", (userAgent) => {
        beforeEach(() => {
            (global as any).userAgent.mockReturnValue(userAgent);
        });

        it("returns a Safari12 device", async () => {
            await getMediasoupDeviceAsync({ safari17HandlerOn: false });

            expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerName: "Safari12" });
        });
    });
});
