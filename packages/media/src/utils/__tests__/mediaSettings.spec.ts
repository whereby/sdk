import {
    ADDITIONAL_SCREEN_SHARE_SETTINGS,
    ADDITIONAL_SCREEN_SHARE_SETTINGS_VP9,
    AUDIO_SETTINGS,
    SCREEN_SHARE_SETTINGS,
    SCREEN_SHARE_SETTINGS_LOW_BANDWIDTH,
    SCREEN_SHARE_SIMULCAST_SETTINGS,
    SCREEN_SHARE_SETTINGS_VP9,
    VIDEO_SETTINGS_HD,
    VIDEO_SETTINGS_SD,
    VIDEO_SETTINGS_VP9,
    VIDEO_SETTINGS_VP9_LOW_BANDWIDTH,
    getMediaSettings,
    sortCodecs,
} from "../mediaSettings";
import { type Codec } from "../mediaSettings";
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
        it("prioritises AV1", async () => {
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
    const x = () => Math.random() > 0.5;

    it.each`
        kind       | isScreenshare | lowDataModeEnabled | isSomeoneAlreadyPresenting | simulcastScreenshareOn | lowBandwidth | vp9On    | expected
        ${"audio"} | ${x()}        | ${x()}             | ${x()}                     | ${x()}                 | ${x()}       | ${x()}   | ${AUDIO_SETTINGS}
        ${"video"} | ${false}      | ${false}           | ${true}                    | ${true}                | ${false}     | ${false} | ${VIDEO_SETTINGS_HD}
        ${"video"} | ${false}      | ${false}           | ${true}                    | ${false}               | ${false}     | ${false} | ${VIDEO_SETTINGS_HD}
        ${"video"} | ${false}      | ${false}           | ${false}                   | ${true}                | ${false}     | ${false} | ${VIDEO_SETTINGS_HD}
        ${"video"} | ${false}      | ${false}           | ${false}                   | ${false}               | ${false}     | ${false} | ${VIDEO_SETTINGS_HD}
        ${"video"} | ${false}      | ${true}            | ${true}                    | ${true}                | ${true}      | ${false} | ${VIDEO_SETTINGS_SD}
        ${"video"} | ${false}      | ${true}            | ${true}                    | ${true}                | ${false}     | ${false} | ${VIDEO_SETTINGS_SD}
        ${"video"} | ${false}      | ${true}            | ${true}                    | ${false}               | ${true}      | ${false} | ${VIDEO_SETTINGS_SD}
        ${"video"} | ${false}      | ${true}            | ${true}                    | ${false}               | ${false}     | ${false} | ${VIDEO_SETTINGS_SD}
        ${"video"} | ${false}      | ${true}            | ${false}                   | ${true}                | ${true}      | ${false} | ${VIDEO_SETTINGS_SD}
        ${"video"} | ${false}      | ${true}            | ${false}                   | ${true}                | ${false}     | ${false} | ${VIDEO_SETTINGS_SD}
        ${"video"} | ${false}      | ${true}            | ${false}                   | ${false}               | ${true}      | ${false} | ${VIDEO_SETTINGS_SD}
        ${"video"} | ${false}      | ${true}            | ${false}                   | ${false}               | ${false}     | ${false} | ${VIDEO_SETTINGS_SD}
        ${"video"} | ${false}      | ${false}           | ${true}                    | ${true}                | ${true}      | ${false} | ${VIDEO_SETTINGS_SD}
        ${"video"} | ${false}      | ${false}           | ${true}                    | ${false}               | ${true}      | ${false} | ${VIDEO_SETTINGS_SD}
        ${"video"} | ${false}      | ${false}           | ${false}                   | ${true}                | ${true}      | ${false} | ${VIDEO_SETTINGS_SD}
        ${"video"} | ${false}      | ${false}           | ${false}                   | ${false}               | ${true}      | ${false} | ${VIDEO_SETTINGS_SD}
        ${"video"} | ${true}       | ${false}           | ${false}                   | ${false}               | ${false}     | ${false} | ${SCREEN_SHARE_SETTINGS}
        ${"video"} | ${true}       | ${true}            | ${false}                   | ${false}               | ${false}     | ${false} | ${SCREEN_SHARE_SETTINGS}
        ${"video"} | ${true}       | ${false}           | ${false}                   | ${false}               | ${false}     | ${true}  | ${SCREEN_SHARE_SETTINGS_VP9}
        ${"video"} | ${true}       | ${true}            | ${false}                   | ${false}               | ${false}     | ${true}  | ${SCREEN_SHARE_SETTINGS_VP9}
        ${"video"} | ${true}       | ${true}            | ${false}                   | ${true}                | ${false}     | ${false} | ${SCREEN_SHARE_SIMULCAST_SETTINGS}
        ${"video"} | ${true}       | ${true}            | ${false}                   | ${false}               | ${true}      | ${false} | ${SCREEN_SHARE_SETTINGS_LOW_BANDWIDTH}
        ${"video"} | ${true}       | ${false}           | ${false}                   | ${false}               | ${true}      | ${false} | ${SCREEN_SHARE_SETTINGS_LOW_BANDWIDTH}
        ${"video"} | ${true}       | ${true}            | ${true}                    | ${false}               | ${true}      | ${false} | ${ADDITIONAL_SCREEN_SHARE_SETTINGS}
        ${"video"} | ${true}       | ${false}           | ${true}                    | ${false}               | ${true}      | ${false} | ${ADDITIONAL_SCREEN_SHARE_SETTINGS}
        ${"video"} | ${true}       | ${true}            | ${true}                    | ${false}               | ${true}      | ${true}  | ${ADDITIONAL_SCREEN_SHARE_SETTINGS_VP9}
        ${"video"} | ${true}       | ${false}           | ${true}                    | ${false}               | ${true}      | ${true}  | ${ADDITIONAL_SCREEN_SHARE_SETTINGS_VP9}
        ${"video"} | ${false}      | ${false}           | ${true}                    | ${true}                | ${false}     | ${true}  | ${VIDEO_SETTINGS_VP9}
        ${"video"} | ${false}      | ${false}           | ${true}                    | ${false}               | ${false}     | ${true}  | ${VIDEO_SETTINGS_VP9}
        ${"video"} | ${false}      | ${false}           | ${false}                   | ${true}                | ${false}     | ${true}  | ${VIDEO_SETTINGS_VP9}
        ${"video"} | ${false}      | ${false}           | ${false}                   | ${false}               | ${false}     | ${true}  | ${VIDEO_SETTINGS_VP9}
        ${"video"} | ${false}      | ${true}            | ${true}                    | ${true}                | ${true}      | ${true}  | ${VIDEO_SETTINGS_VP9_LOW_BANDWIDTH}
        ${"video"} | ${false}      | ${true}            | ${true}                    | ${false}               | ${true}      | ${true}  | ${VIDEO_SETTINGS_VP9_LOW_BANDWIDTH}
        ${"video"} | ${false}      | ${true}            | ${false}                   | ${true}                | ${true}      | ${true}  | ${VIDEO_SETTINGS_VP9_LOW_BANDWIDTH}
        ${"video"} | ${false}      | ${true}            | ${false}                   | ${false}               | ${true}      | ${true}  | ${VIDEO_SETTINGS_VP9_LOW_BANDWIDTH}
        ${"video"} | ${false}      | ${false}           | ${true}                    | ${true}                | ${true}      | ${true}  | ${VIDEO_SETTINGS_VP9_LOW_BANDWIDTH}
        ${"video"} | ${false}      | ${false}           | ${true}                    | ${false}               | ${true}      | ${true}  | ${VIDEO_SETTINGS_VP9_LOW_BANDWIDTH}
        ${"video"} | ${false}      | ${false}           | ${false}                   | ${true}                | ${true}      | ${true}  | ${VIDEO_SETTINGS_VP9_LOW_BANDWIDTH}
        ${"video"} | ${false}      | ${false}           | ${false}                   | ${false}               | ${true}      | ${true}  | ${VIDEO_SETTINGS_VP9_LOW_BANDWIDTH}
    `(
        "should return $expected when isScreenshare:$isScreenshare, isSomeoneAlreadyPresenting:$isSomeoneAlreadyPresenting, lowDataModeEnabled:$lowDataModeEnabled, simulcastScreenshareOn:$simulcastScreenshareOn, lowBandwidth:$lowBandwidth, vp9On:$vp9On",
        ({
            kind,
            isScreenshare,
            isSomeoneAlreadyPresenting,
            lowDataModeEnabled,
            simulcastScreenshareOn,
            lowBandwidth,
            vp9On,
            expected,
        }) => {
            const features = { lowDataModeEnabled, simulcastScreenshareOn, lowBandwidth, vp9On };

            expect(getMediaSettings(kind, isScreenshare, features, isSomeoneAlreadyPresenting)).toEqual(expected);
        },
    );
});
