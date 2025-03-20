import { sortCodecs } from "../mediaSettings";
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
        it("puts hardware decodable codecs first", async () => {
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
    });
});
