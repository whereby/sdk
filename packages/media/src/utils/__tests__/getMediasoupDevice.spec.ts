import { getMediasoupDevice } from "../getMediasoupDevice";

jest.mock("mediasoup-client", () => ({
    Device: jest.fn(),
    detectDevice: jest.fn(),
}));
const mediasoupClient = jest.requireMock("mediasoup-client");
jest.mock("../Safari17Handler");
const { Safari17 } = jest.requireMock("../Safari17Handler");

const safari17UserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const safari18UserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1.1 Safari/605.1.15";

describe("getMediasoupClient", () => {
    const features = {};
    (global as any).userAgent = jest.spyOn(navigator, "userAgent", "get");

    it("returns the resolved handler from mediasoup-client", () => {
        mediasoupClient.detectDevice.mockImplementationOnce(() => "Chrome111");

        getMediasoupDevice(features);

        expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerName: "Chrome111" });
    });

    describe("when the browser version is Safari12", () => {
        beforeEach(() => {
            mediasoupClient.detectDevice.mockImplementationOnce(() => "Safari12");
        });

        it("returns the resolved handler from mediasoup-client", () => {
            getMediasoupDevice(features);

            expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerName: "Safari12" });
        });

        describe.each([
            { version: 17, userAgent: safari17UserAgent },
            { version: 18, userAgent: safari18UserAgent },
        ])("when the user agent version is $version", ({ userAgent }) => {
            beforeEach(() => {
                (global as any).userAgent.mockReturnValue(userAgent);
            });

            it("returns the resolved handler from mediasoup-client", () => {
                getMediasoupDevice(features);

                expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerName: "Safari12" });
            });

            describe("when the safari17HandlerOn feature is enabled", () => {
                it("returns a Safari17 device", () => {
                    const factory = jest.fn();
                    Safari17.createFactory.mockImplementation(() => factory);

                    getMediasoupDevice({ safari17HandlerOn: true });

                    expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerFactory: factory });
                });
            });
        });
    });

    describe.each(["applecoremedia", "applewebkit", "safari"])("when the userAgent matches %s", (userAgent) => {
        beforeEach(() => {
            (global as any).userAgent.mockReturnValue(userAgent);
        });

        it("returns a Safari12 device", () => {
            const factory = jest.fn();
            Safari17.createFactory.mockImplementation(() => factory);

            getMediasoupDevice({ safari17HandlerOn: false });

            expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerName: "Safari12" });
        });
    });

    describe.each(["iphone", "ipad"])("when the userAgent matches %s", (userAgent) => {
        beforeEach(() => {
            (global as any).userAgent.mockReturnValue(userAgent);
        });

        it("returns a Safari12 device", () => {
            const factory = jest.fn();
            Safari17.createFactory.mockImplementation(() => factory);

            getMediasoupDevice({ safari17HandlerOn: false });

            expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerName: "Safari12" });
        });

        describe("when the safari17HandlerOn feature is enabled", () => {
            it("returns a Safari17 device", () => {
                const factory = jest.fn();
                Safari17.createFactory.mockImplementation(() => factory);

                getMediasoupDevice({ safari17HandlerOn: true });

                expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerFactory: factory });
            });
        });
    });
});
