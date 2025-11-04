import { getMediasoupDeviceAsync } from "../getMediasoupDevice";
import { Safari17 } from "../../webrtc/VegaRtcManager/Safari17Handler";

jest.mock("mediasoup-client", () => ({
    Device: jest.fn(),
    detectDeviceAsync: jest.fn(),
}));

jest.mock("../../webrtc/VegaRtcManager/Safari17Handler")

const mediasoupClient = jest.requireMock("mediasoup-client");

const safari17UserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const safari18UserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1.1 Safari/605.1.15";
const safari26UserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const safari26MobileUserAgent =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1";

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
            { version: 26, userAgent: safari26UserAgent },
            { version: 26, userAgent: safari26MobileUserAgent },
        ])("when the safari user agent version is $version", ({ userAgent }) => {
            beforeEach(() => {
                (global as any).userAgent.mockReturnValue(userAgent);
            });

            it("returns the resolved handler from mediasoup-client", async () => {
                await getMediasoupDeviceAsync(features);

                expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerName: "Safari12" });
            });

            describe("and the safari17 handler is enabled", () => {
                it("returns the Safari17 Handler", async () => {
                    const factory = jest.fn();
                    (Safari17.createFactory as jest.Mock).mockImplementationOnce(() =>  factory);

                    await getMediasoupDeviceAsync({ ...features, safari17HandlerOn: true });

                    expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerFactory: factory });
                });
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
