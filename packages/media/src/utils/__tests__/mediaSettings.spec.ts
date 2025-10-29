import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import {
    ADDITIONAL_SCREEN_SHARE_SETTINGS,
    AUDIO_SETTINGS,
    SCREEN_SHARE_SETTINGS,
    SCREEN_SHARE_SIMULCAST_SETTINGS,
    VIDEO_SETTINGS_HD,
    VIDEO_SETTINGS_SD,
    VIDEO_SETTINGS_VP9,
    VIDEO_SETTINGS_VP9_LOW_BANDWIDTH,
    sortCodecs,
    getMediaSettings,
    modifyMediaCapabilities,
} from "../mediaSettings";
import { type Codec } from "../mediaSettings";
import mockRouterRtpCapabilities from "./mockRouterRtpCapabilities.json";
import assert from "assert";

jest.mock("webrtc-adapter", () => ({ browserDetails: { browser: "firefox" } }));

describe("sortCodecs", () => {
    const codecs: Codec[] = [
        {
            clockRate: 90000,
            mimeType: "video/VP8",
        },
        {
            clockRate: 90000,
            mimeType: "video/VP9",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
        },
        {
            clockRate: 90000,
            mimeType: "video/AV1",
        },
    ];
    const decodingInfo = jest.fn();
    decodingInfo.mockImplementation((config: { video: { contentType: string } }) => {
        return {
            powerEfficient: config.video.contentType !== "video/VP8" && config.video.contentType !== "video/VP9",
        };
    });
    Object.assign(globalThis.navigator, { mediaCapabilities: { decodingInfo } });

    it("puts hardware decodable codecs first, prioritising VP9 otherwise", async () => {
        const decodingInfo = jest.fn();
        decodingInfo.mockImplementation((config: { video: { contentType: string } }) => {
            return {
                powerEfficient: config.video.contentType !== "video/VP8" && config.video.contentType !== "video/VP9",
            };
        });
        Object.assign(globalThis.navigator, { mediaCapabilities: { decodingInfo } });

        const sorted = await sortCodecs(codecs, {});

        expect(sorted).toEqual([
            {
                clockRate: 90000,
                mimeType: "video/H264",
            },
            {
                clockRate: 90000,
                mimeType: "video/AV1",
            },
            {
                clockRate: 90000,
                mimeType: "video/VP9",
            },
            {
                clockRate: 90000,
                mimeType: "video/VP8",
            },
        ]);
    });

    describe("with av1On enabled", () => {
        it("returns the sorted array", async () => {
            const sorted = await sortCodecs(codecs, { av1On: true });

            expect(sorted.findIndex((codec: Codec) => !!codec.mimeType.match(/av1/i))).toEqual(0);
        });

        it("leaves the rest of the array in order", async () => {
            const removeAv1 = (codec: Codec) => !codec.mimeType.match(/av1/i);
            const sortedFiltered = (await sortCodecs(codecs, { av1On: true })).filter(removeAv1);
            const unsortedFiltered = codecs.filter(removeAv1);

            expect(sortedFiltered).toEqual(unsortedFiltered);
        });
    });
});

describe("getMediaSettings", () => {
    const randomBoolean = () => Math.random() > 0.5;
    const randomBrowser = () => (randomBoolean() ? "chrome" : "not chrome");

    it.each`
        kind       | isScreenshare      | lowDataModeEnabled | areTooManyAlreadyPresenting | simulcastScreenshareOn | vp9On              | browser            | expected                            | expectedName
        ${"audio"} | ${randomBoolean()} | ${randomBoolean()} | ${randomBoolean()}          | ${randomBoolean()}     | ${randomBoolean()} | ${randomBrowser()} | ${AUDIO_SETTINGS}                   | ${"AUDIO_SETTINGS"}
        ${"video"} | ${false}           | ${false}           | ${randomBoolean()}          | ${randomBoolean()}     | ${false}           | ${randomBrowser()} | ${VIDEO_SETTINGS_HD}                | ${"VIDEO_SETTINGS_HD"}
        ${"video"} | ${false}           | ${false}           | ${randomBoolean()}          | ${randomBoolean()}     | ${true}            | ${"not_chrome"}    | ${VIDEO_SETTINGS_HD}                | ${"VIDEO_SETTINGS_HD"}
        ${"video"} | ${false}           | ${true}            | ${randomBoolean()}          | ${randomBoolean()}     | ${false}           | ${randomBrowser()} | ${VIDEO_SETTINGS_SD}                | ${"VIDEO_SETTINGS_SD"}
        ${"video"} | ${false}           | ${true}            | ${randomBoolean()}          | ${randomBoolean()}     | ${true}            | ${"not_chrome"}    | ${VIDEO_SETTINGS_SD}                | ${"VIDEO_SETTINGS_SD"}
        ${"video"} | ${true}            | ${randomBoolean()} | ${false}                    | ${false}               | ${false}           | ${randomBrowser()} | ${SCREEN_SHARE_SETTINGS}            | ${"SCREEN_SHARE_SETTINGS"}
        ${"video"} | ${true}            | ${randomBoolean()} | ${false}                    | ${true}                | ${randomBoolean()} | ${randomBrowser()} | ${SCREEN_SHARE_SIMULCAST_SETTINGS}  | ${"SCREEN_SHARE_SIMULCAST_SETTINGS"}
        ${"video"} | ${true}            | ${randomBoolean()} | ${true}                     | ${false}               | ${randomBoolean()} | ${randomBrowser()} | ${ADDITIONAL_SCREEN_SHARE_SETTINGS} | ${"ADDITIONAL_SCREEN_SHARE_SETTINGS"}
        ${"video"} | ${false}           | ${false}           | ${randomBoolean()}          | ${randomBoolean()}     | ${true}            | ${"chrome"}        | ${VIDEO_SETTINGS_VP9}               | ${"VIDEO_SETTINGS_VP9"}
        ${"video"} | ${false}           | ${true}            | ${randomBoolean()}          | ${randomBoolean()}     | ${true}            | ${"chrome"}        | ${VIDEO_SETTINGS_VP9_LOW_BANDWIDTH} | ${"VIDEO_SETTINGS_VP9_LOW_BANDWIDTH"}
    `(
        "should return $expectedName when isScreenshare:$isScreenshare, areTooManyAlreadyPresenting:$areTooManyAlreadyPresenting, lowDataModeEnabled:$lowDataModeEnabled, simulcastScreenshareOn:$simulcastScreenshareOn, vp9On:$vp9On, browser:$browser",
        ({
            kind,
            isScreenshare,
            areTooManyAlreadyPresenting,
            lowDataModeEnabled,
            simulcastScreenshareOn,
            vp9On,
            browser,
            expected,
        }) => {
            const webrtcAdapterMock = jest.requireMock("webrtc-adapter");
            webrtcAdapterMock.browserDetails.browser = browser;

            const features = {
                lowDataModeEnabled,
                simulcastScreenshareOn,
                vp9On,
            };

            expect(getMediaSettings(kind, isScreenshare, features, areTooManyAlreadyPresenting)).toEqual(expected);
        },
    );
});

describe("modifyMediaCapabilities", () => {
    it("does nothing with no flags", () => {
        const modifiedCapabilities = modifyMediaCapabilities(mockRouterRtpCapabilities as RtpCapabilities, {});

        expect(modifiedCapabilities).toEqual(mockRouterRtpCapabilities);
    });

    it("prioritizes H264", () => {
        const modifiedCapabilities = modifyMediaCapabilities(mockRouterRtpCapabilities as RtpCapabilities, {
            h264On: true,
            vp9On: false,
        });

        expect(modifiedCapabilities.codecs?.length).toEqual(mockRouterRtpCapabilities.codecs.length);
        assert(modifiedCapabilities.codecs); // for typescript
        expect(modifiedCapabilities.codecs[0].mimeType).toEqual("video/H264");
        expect(modifiedCapabilities.codecs[1].parameters?.apt).toEqual(
            modifiedCapabilities.codecs[0].preferredPayloadType,
        );
    });

    describe("vp9On", () => {
        describe("when not using chrome", () => {
            beforeEach(() => {
                const webrtcAdapter = jest.requireMock("webrtc-adapter");
                webrtcAdapter.browserDetails.browser = "firefox";
            });

            it("does nothing", () => {
                const modifiedCapabilities = modifyMediaCapabilities(mockRouterRtpCapabilities as RtpCapabilities, {
                    vp9On: true,
                });

                expect(modifiedCapabilities).toEqual(mockRouterRtpCapabilities);
            });
        });
        describe("when using chrome", () => {
            beforeEach(() => {
                const webrtcAdapter = jest.requireMock("webrtc-adapter");
                webrtcAdapter.browserDetails.browser = "chrome";
            });

            it("prioritizes VP9", () => {
                const modifiedCapabilities = modifyMediaCapabilities(mockRouterRtpCapabilities as RtpCapabilities, {
                    vp9On: true,
                });

                expect(modifiedCapabilities.codecs?.length).toEqual(mockRouterRtpCapabilities.codecs.length);
                assert(modifiedCapabilities.codecs); // for typescript
                expect(modifiedCapabilities.codecs[0].mimeType).toEqual("video/VP9");
                expect(modifiedCapabilities.codecs[1].parameters?.apt).toEqual(
                    modifiedCapabilities.codecs[0].preferredPayloadType,
                );
            });

            it("prioritizes VP9 over H264", () => {
                const modifiedCapabilities = modifyMediaCapabilities(mockRouterRtpCapabilities as RtpCapabilities, {
                    vp9On: true,
                    h264On: true,
                });

                expect(modifiedCapabilities.codecs?.length).toEqual(mockRouterRtpCapabilities.codecs.length);
                assert(modifiedCapabilities.codecs); // for typescript
                expect(modifiedCapabilities.codecs[0].mimeType).toEqual("video/VP9");
                expect(modifiedCapabilities.codecs[1].parameters?.apt).toEqual(
                    modifiedCapabilities.codecs[0].preferredPayloadType,
                );
            });
        });
    });
});
