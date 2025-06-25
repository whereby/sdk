import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import {
    ADDITIONAL_SCREEN_SHARE_SETTINGS,
    ADDITIONAL_SCREEN_SHARE_SETTINGS_VP9,
    AUDIO_SETTINGS,
    SCREEN_SHARE_SETTINGS,
    SCREEN_SHARE_SIMULCAST_SETTINGS,
    SCREEN_SHARE_SETTINGS_VP9,
    VIDEO_SETTINGS_HD,
    VIDEO_SETTINGS_SD,
    VIDEO_SETTINGS_VP9,
    VIDEO_SETTINGS_VP9_KEY,
    VIDEO_SETTINGS_VP9_LOW_BANDWIDTH,
    VIDEO_SETTINGS_VP9_LOW_BANDWIDTH_KEY,
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
            mimeType: "video/rtx",
        },
        {
            clockRate: 90000,
            mimeType: "video/VP9",
            sdpFmtpLine: "profile-id=0",
        },
        {
            clockRate: 90000,
            mimeType: "video/VP9",
            sdpFmtpLine: "profile-id=2",
        },
        {
            clockRate: 90000,
            mimeType: "video/VP9",
            sdpFmtpLine: "profile-id=1",
        },
        {
            clockRate: 90000,
            mimeType: "video/VP9",
            sdpFmtpLine: "profile-id=3",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine: "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine: "level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine: "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine: "level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine: "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine: "level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=4d001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine: "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=f4001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine: "level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=f4001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/AV1",
            sdpFmtpLine: "level-idx=5;profile=0;tier=0",
        },
        {
            clockRate: 90000,
            mimeType: "video/AV1",
            sdpFmtpLine: "level-idx=5;profile=1;tier=0",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine: "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=64001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine: "level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=64001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/red",
        },
        {
            clockRate: 90000,
            mimeType: "video/ulpfec",
        },
        {
            clockRate: 90000,
            mimeType: "video/flexfec-03",
            sdpFmtpLine: "repair-window=10000000",
        },
    ];
    describe("with no flags enabled", () => {
        it("returns the array unchanged", async () => {
            const sorted = await sortCodecs(codecs, {});

            expect(sorted).toEqual(codecs);
        });
    });

    describe("with vp9On enabled", () => {
        it("returns the sorted array", async () => {
            const sorted = await sortCodecs(codecs, { vp9On: true });

            expect(sorted.findIndex((codec: Codec) => !!codec.mimeType.match(/vp9/i))).toEqual(0);
        });

        it("leaves the rest of the array in order", async () => {
            const removeVp9 = (codec: Codec) => !codec.mimeType.match(/vp9/i);
            const sortedFiltered = (await sortCodecs(codecs, { av1On: true, vp9On: true })).filter(removeVp9);
            const unsortedFiltered = codecs.filter(removeVp9);

            expect(sortedFiltered).toEqual(unsortedFiltered);
        });
    });

    describe("with av1On enabled", () => {
        it("returns the sorted array", async () => {
            const sorted = await sortCodecs(codecs, { av1On: true });

            expect(sorted.findIndex((codec: Codec) => !!codec.mimeType.match(/av1/i))).toEqual(0);
        });

        it("leaves the rest of the array in order", async () => {
            const removeAv1 = (codec: Codec) => !codec.mimeType.match(/av1/i);
            const sortedFiltered = (await sortCodecs(codecs, { av1On: true, vp9On: false })).filter(removeAv1);
            const unsortedFiltered = codecs.filter(removeAv1);

            expect(sortedFiltered).toEqual(unsortedFiltered);
        });
    });

    describe("with av1On and vp9On enabled", () => {
        it("prioritizes AV1", async () => {
            const sorted = await sortCodecs(codecs, { av1On: true, vp9On: true });

            expect(sorted.findIndex((codec: Codec) => !!codec.mimeType.match(/av1/i))).toEqual(0);
            expect(sorted.findIndex((codec: Codec) => !!codec.mimeType.match(/vp9/i))).toEqual(2);
        });

        it("leaves the rest of the array in order", async () => {
            const removeVp9AndAv1 = (codec: Codec) => !codec.mimeType.match(/vp9|av1/i);
            const sortedFiltered = (await sortCodecs(codecs, { av1On: true, vp9On: true })).filter(removeVp9AndAv1);
            const unsortedFiltered = codecs.filter(removeVp9AndAv1);

            expect(sortedFiltered).toEqual(unsortedFiltered);
        });
    });

    describe("with preferHardwareDecodingOn enabled", () => {
        const codecs = [
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
                mimeType: "video/AV1",
            },
            {
                clockRate: 90000,
                mimeType: "video/H264",
            },
        ];
        it("puts hardware decodable codecs first", async () => {
            const decodingInfo = jest.fn();
            decodingInfo.mockImplementation((config: { video: { contentType: string } }) => {
                return {
                    powerEfficient: config.video.contentType !== "video/VP8",
                };
            });
            Object.assign(globalThis.navigator, { mediaCapabilities: { decodingInfo } });

            const sorted = await sortCodecs(codecs, { preferHardwareDecodingOn: true });

            expect(sorted).toEqual([
                {
                    clockRate: 90000,
                    mimeType: "video/VP9",
                },
                {
                    clockRate: 90000,
                    mimeType: "video/AV1",
                },
                {
                    clockRate: 90000,
                    mimeType: "video/H264",
                },
                {
                    clockRate: 90000,
                    mimeType: "video/VP8",
                },
            ]);
        });

        describe("with vp9On", () => {
            it("puts hardware decodable codecs first, prioritising VP9 otherwise", async () => {
                const decodingInfo = jest.fn();
                decodingInfo.mockImplementation((config: { video: { contentType: string } }) => {
                    return {
                        powerEfficient:
                            config.video.contentType !== "video/VP8" && config.video.contentType !== "video/VP9",
                    };
                });
                Object.assign(globalThis.navigator, { mediaCapabilities: { decodingInfo } });

                const sorted = await sortCodecs(codecs, { preferHardwareDecodingOn: true, vp9On: true });

                expect(sorted).toEqual([
                    {
                        clockRate: 90000,
                        mimeType: "video/AV1",
                    },
                    {
                        clockRate: 90000,
                        mimeType: "video/H264",
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
        });
    });
});

describe("getMediaSettings", () => {
    const randomBoolean = () => Math.random() > 0.5;
    const randomBrowser = () => (randomBoolean() ? "chrome" : "not chrome");

    it.each`
        kind       | isScreenshare      | lowDataModeEnabled | isSomeoneAlreadyPresenting | simulcastScreenshareOn | vp9On              | svcKeyScalabilityModeOn | browser            | expected                                | expectedName
        ${"audio"} | ${randomBoolean()} | ${randomBoolean()} | ${randomBoolean()}         | ${randomBoolean()}     | ${randomBoolean()} | ${randomBoolean()}      | ${randomBrowser()} | ${AUDIO_SETTINGS}                       | ${"AUDIO_SETTINGS"}
        ${"video"} | ${false}           | ${false}           | ${randomBoolean()}         | ${randomBoolean()}     | ${false}           | ${randomBoolean()}      | ${randomBrowser()} | ${VIDEO_SETTINGS_HD}                    | ${"VIDEO_SETTINGS_HD"}
        ${"video"} | ${false}           | ${false}           | ${randomBoolean()}         | ${randomBoolean()}     | ${true}            | ${randomBoolean()}      | ${"not_chrome"}    | ${VIDEO_SETTINGS_HD}                    | ${"VIDEO_SETTINGS_HD"}
        ${"video"} | ${false}           | ${true}            | ${randomBoolean()}         | ${randomBoolean()}     | ${false}           | ${randomBoolean()}      | ${randomBrowser()} | ${VIDEO_SETTINGS_SD}                    | ${"VIDEO_SETTINGS_SD"}
        ${"video"} | ${false}           | ${true}            | ${randomBoolean()}         | ${randomBoolean()}     | ${true}            | ${randomBoolean()}      | ${"not_chrome"}    | ${VIDEO_SETTINGS_SD}                    | ${"VIDEO_SETTINGS_SD"}
        ${"video"} | ${true}            | ${randomBoolean()} | ${false}                   | ${false}               | ${false}           | ${randomBoolean()}      | ${randomBrowser()} | ${SCREEN_SHARE_SETTINGS}                | ${"SCREEN_SHARE_SETTINGS"}
        ${"video"} | ${true}            | ${randomBoolean()} | ${false}                   | ${false}               | ${true}            | ${randomBoolean()}      | ${"not chrome"}    | ${SCREEN_SHARE_SETTINGS}                | ${"SCREEN_SHARE_SETTINGS"}
        ${"video"} | ${true}            | ${randomBoolean()} | ${false}                   | ${false}               | ${true}            | ${randomBoolean()}      | ${"chrome"}        | ${SCREEN_SHARE_SETTINGS_VP9}            | ${"SCREEN_SHARE_SETTINGS_VP9"}
        ${"video"} | ${true}            | ${randomBoolean()} | ${false}                   | ${true}                | ${false}           | ${randomBoolean()}      | ${randomBrowser()} | ${SCREEN_SHARE_SIMULCAST_SETTINGS}      | ${"SCREEN_SHARE_SIMULCAST_SETTINGS"}
        ${"video"} | ${true}            | ${randomBoolean()} | ${true}                    | ${false}               | ${false}           | ${randomBoolean()}      | ${randomBrowser()} | ${ADDITIONAL_SCREEN_SHARE_SETTINGS}     | ${"ADDITIONAL_SCREEN_SHARE_SETTINGS"}
        ${"video"} | ${true}            | ${randomBoolean()} | ${true}                    | ${false}               | ${true}            | ${randomBoolean()}      | ${"not chrome"}    | ${ADDITIONAL_SCREEN_SHARE_SETTINGS}     | ${"ADDITIONAL_SCREEN_SHARE_SETTINGS"}
        ${"video"} | ${true}            | ${randomBoolean()} | ${true}                    | ${false}               | ${true}            | ${randomBoolean()}      | ${"chrome"}        | ${ADDITIONAL_SCREEN_SHARE_SETTINGS_VP9} | ${"ADDITIONAL_SCREEN_SHARE_SETTINGS_VP9"}
        ${"video"} | ${false}           | ${false}           | ${randomBoolean()}         | ${randomBoolean()}     | ${true}            | ${false}                | ${"chrome"}        | ${VIDEO_SETTINGS_VP9}                   | ${"VIDEO_SETTINGS_VP9"}
        ${"video"} | ${false}           | ${false}           | ${randomBoolean()}         | ${randomBoolean()}     | ${true}            | ${true}                 | ${"chrome"}        | ${VIDEO_SETTINGS_VP9_KEY}               | ${"VIDEO_SETTINGS_VP9_KEY"}
        ${"video"} | ${false}           | ${true}            | ${randomBoolean()}         | ${randomBoolean()}     | ${true}            | ${false}                | ${"chrome"}        | ${VIDEO_SETTINGS_VP9_LOW_BANDWIDTH}     | ${"VIDEO_SETTINGS_VP9_LOW_BANDWIDTH"}
        ${"video"} | ${false}           | ${true}            | ${randomBoolean()}         | ${randomBoolean()}     | ${true}            | ${true}                 | ${"chrome"}        | ${VIDEO_SETTINGS_VP9_LOW_BANDWIDTH_KEY} | ${"VIDEO_SETTINGS_VP9_LOW_BANDWIDTH_KEY"}
    `(
        "should return $expectedName when isScreenshare:$isScreenshare, isSomeoneAlreadyPresenting:$isSomeoneAlreadyPresenting, lowDataModeEnabled:$lowDataModeEnabled, simulcastScreenshareOn:$simulcastScreenshareOn, vp9On:$vp9On, svcKeyScalabilityModeOn:$svcKeyScalabilityModeOn, browser:$browser",
        ({
            kind,
            isScreenshare,
            isSomeoneAlreadyPresenting,
            lowDataModeEnabled,
            simulcastScreenshareOn,
            vp9On,
            svcKeyScalabilityModeOn,
            browser,
            expected,
        }) => {
            const webrtcAdapterMock = jest.requireMock("webrtc-adapter");
            webrtcAdapterMock.browserDetails.browser = browser;

            const features = {
                lowDataModeEnabled,
                simulcastScreenshareOn,
                vp9On,
                svcKeyScalabilityModeOn,
            };

            expect(getMediaSettings(kind, isScreenshare, features, isSomeoneAlreadyPresenting)).toEqual(expected);
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
