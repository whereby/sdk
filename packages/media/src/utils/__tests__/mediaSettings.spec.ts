import { sortCodecsByMimeType } from "../mediaSettings";
import { type Codec } from "../mediaSettings";

describe("sortCodecsByMimeType", () => {
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
            sdpFmtpLine:
                "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine:
                "level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine:
                "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine:
                "level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine:
                "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine:
                "level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=4d001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine:
                "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=f4001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine:
                "level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=f4001f",
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
            sdpFmtpLine:
                "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=64001f",
        },
        {
            clockRate: 90000,
            mimeType: "video/H264",
            sdpFmtpLine:
                "level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=64001f",
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
        it("returns the array unchanged", () => {
            expect(sortCodecsByMimeType(codecs, {})).toEqual(codecs);
        });
    });

    describe("with vp9On enabled", () => {
        it("returns the sorted array", () => {
            const sorted = sortCodecsByMimeType(codecs, { vp9On: true });
            expect(sorted.findIndex((codec: Codec) => !!codec.mimeType.match(/vp9/i)))
                .toEqual(0);
        });

        it("leaves the rest of the array in order", () => {
            const removeVp9 = (codec: Codec) => !codec.mimeType.match(/vp9/i)
            const sortedFiltered = sortCodecsByMimeType(codecs, { av1On: true, vp9On: true }).filter(removeVp9);
            const unsortedFiltered = codecs.filter(removeVp9)
            expect(sortedFiltered).toEqual(unsortedFiltered)
        })
    });

    describe("with av1On enabled", () => {
        it("returns the sorted array", () => {
            const sorted = sortCodecsByMimeType(codecs, { av1On: true });
            expect(sorted.findIndex((codec: Codec) => !!codec.mimeType.match(/av1/i)))
                .toEqual(0);
        });

        it("leaves the rest of the array in order", () => {
            const removeAv1 = (codec: Codec) => !codec.mimeType.match(/av1/i)
            const sortedFiltered = sortCodecsByMimeType(codecs, { av1On: true, vp9On: true }).filter(removeAv1);
            const unsortedFiltered = codecs.filter(removeAv1)
            expect(sortedFiltered).toEqual(unsortedFiltered)
        })
    });

    describe("with av1On and vp9On enabled", () => {
        it("prioritises AV1", () => {
            const sorted = sortCodecsByMimeType(codecs, { av1On: true, vp9On: true });
            expect(sorted.findIndex((codec: Codec) => !!codec.mimeType.match(/av1/i)))
                .toEqual(0);
            expect(sorted.findIndex((codec: Codec) => !!codec.mimeType.match(/vp9/i)))
                .toEqual(2);
        });

        it("leaves the rest of the array in order", () => {
            const removeVp9AndAv1 = (codec: Codec) => !codec.mimeType.match(/vp9|av1/i)
            const sortedFiltered = sortCodecsByMimeType(codecs, { av1On: true, vp9On: true }).filter(removeVp9AndAv1);
            const unsortedFiltered = codecs.filter(removeVp9AndAv1)
            expect(sortedFiltered).toEqual(unsortedFiltered)
        })
    })
});
