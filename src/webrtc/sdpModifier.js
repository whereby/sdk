import SDPUtils from "sdp";
import adapterRaw from "webrtc-adapter";
import * as sdpTransform from "sdp-transform";
import Logger from "../utils/Logger";

const adapter = adapterRaw.default ?? adapterRaw;
const logger = new Logger();

const browserName = adapter.browserDetails.browser;
const browserVersion = adapter.browserDetails.version;

export function setCodecPreferenceSDP(sdp, vp9On, redOn) {
    try {
        const sdpObject = sdpTransform.parse(sdp);
        if (Array.isArray(sdpObject?.media)) {
            //audio
            const mediaAudio = sdpObject.media.find((m) => m.type === "audio");
            if (Array.isArray(mediaAudio?.rtp)) {
                const rtp = mediaAudio.rtp;
                for (let i = 0; i < rtp.length; i++) {
                    if (redOn && rtp[i].codec === "red") {
                        const payloads = mediaAudio.payloads.split(" ");
                        const pt = payloads.indexOf("" + rtp[i].payload);
                        if (pt && pt !== -1 && pt >= 0) {
                            payloads.unshift(payloads.splice(pt, 1)[0]);
                            mediaAudio.payloads = payloads.join(" ");
                        }
                    }
                }
            }
            //video
            const mediaVideo = sdpObject.media.find((m) => m.type === "video");
            if (Array.isArray(mediaVideo?.rtp)) {
                const rtp = mediaVideo.rtp;
                for (let i = 0; i < rtp.length; i++) {
                    if (vp9On && rtp[i].codec === "VP9") {
                        const payloads = mediaVideo.payloads.split(" ");
                        const pt = payloads.indexOf("" + rtp[i].payload);
                        if (pt && pt !== -1 && pt >= 0) {
                            payloads.unshift(payloads.splice(pt, 1)[0]);
                            mediaVideo.payloads = payloads.join(" ");
                        }
                    }
                }
            }
        }
        const newSdp = sdpTransform.write(sdpObject);
        return newSdp;
    } catch (error) {
        logger.error("setCodecPreferenceSDP error:", error);
    }
}
// Safari does not like VP8-only offers
// https://bugs.chromium.org/p/webrtc/issues/detail?id=4957
// This sets the m-line as rejected.
export function maybeRejectNoH264(sdp) {
    if (browserName !== "safari") {
        return sdp;
    }
    const sections = SDPUtils.splitSections(sdp);
    for (let i = 1; i < sections.length; i++) {
        if (SDPUtils.getKind(sections[i]) !== "video") {
            continue;
        }
        const codecs = SDPUtils.matchPrefix(sections[i], "a=rtpmap:")
            .map((line) => {
                return SDPUtils.parseRtpMap(line);
            })
            .map((codec) => {
                return codec.name.toUpperCase();
            });

        // this m-line has...
        if (
            codecs.indexOf("H264") === -1 && // no H264
            sections[i][8] === "9"
        ) {
            // and is not rejected
            sections[i] = sections[i].replace("m=video 9 ", "m=video 0 "); // reject it.
        }
    }
    return sections.join("");
}

// SDP mangling for deprioritizing H264
export function deprioritizeH264(sdp) {
    return SDPUtils.splitSections(sdp)
        .map((section) => {
            // only modify video sections
            if (SDPUtils.getKind(section) !== "video") return section;

            // list of payloadTypes used in this sdp/section
            const h264payloadTypes = SDPUtils.matchPrefix(section, "a=rtpmap:")
                .map((line) => SDPUtils.parseRtpMap(line))
                .filter((codec) => /h264/i.test(codec.name))
                .map((codec) => "" + codec.payloadType);

            // return as is if no h264 found
            if (!h264payloadTypes.length) return section;

            // reorder and replace
            const mline = SDPUtils.matchPrefix(section, "m=video")[0];
            const mlinePayloadsSection = /(\s\d+)+$/i.exec(mline)[0];
            const mlinePayloadsNonH264 = mlinePayloadsSection
                .split(" ")
                .filter((payloadType) => payloadType && !h264payloadTypes.includes(payloadType));
            const reorderedPayloads = [...mlinePayloadsNonH264, ...h264payloadTypes].join(" ");
            const newmline = mline.replace(mlinePayloadsSection, " " + reorderedPayloads);
            return section.replace(mline, newmline);
        })
        .join("");
}

// TODO: currently assumes video, look at track.kind
// ensures that SSRCs in new description match ssrcs in old description
export function replaceSSRCs(currentDescription, newDescription) {
    let ssrcs = currentDescription.match(/a=ssrc-group:FID (\d+) (\d+)\r\n/);
    let newssrcs = newDescription.match(/a=ssrc-group:FID (\d+) (\d+)\r\n/);
    // Firefox offers dont have a FID ssrc group (yet)
    if (!ssrcs) {
        ssrcs = currentDescription.match(/a=ssrc:(\d+) cname:(.*)\r\n/g)[1].match(/a=ssrc:(\d+)/);
        newssrcs = newDescription.match(/a=ssrc:(\d+) cname:(.*)\r\n/g)[1].match(/a=ssrc:(\d+)/);
    }
    for (let i = 1; i < ssrcs.length; i++) {
        newDescription = newDescription.replace(new RegExp(newssrcs[i], "g"), ssrcs[i]);
    }
    return newDescription;
}

// Firefox < 63 (but not Firefox ESR 60) is affected by this:
// https://bugzilla.mozilla.org/show_bug.cgi?id=1478685
// filter out the mid rtp header extension
export function filterMidExtension(sdp) {
    if (browserName !== "safari" && (browserName !== "firefox" || browserVersion >= 63 || browserVersion === 60)) {
        return sdp;
    }
    return (
        SDPUtils.splitLines(sdp.trim())
            .filter((line) => {
                if (!line.startsWith("a=extmap:")) {
                    return true;
                }
                const extmap = SDPUtils.parseExtmap(line);
                return extmap.uri !== "urn:ietf:params:rtp-hdrext:sdes:mid";
            })
            .join("\r\n") + "\r\n"
    );
}

// Firefox < 68 (at least) is affected by this, although it is not
// clear that FF is to blame:
// https://bugzilla.mozilla.org/show_bug.cgi?id=1534673
// Filter out a:msid-semantic header
export function filterMsidSemantic(sdp) {
    if (browserName !== "firefox") {
        return sdp;
    }
    return (
        SDPUtils.splitLines(sdp.trim())
            .map((line) => (line.startsWith("a=msid-semantic:") ? "a=msid-semantic: WMS *" : line))
            .join("\r\n") + "\r\n"
    );
}

export function changeMediaDirection(sdp, active) {
    const sections = SDPUtils.splitSections(sdp);
    return (
        sections.shift() +
        sections
            .map((section) => {
                const currentDirection = SDPUtils.getDirection(section);
                return section.replace("a=" + currentDirection, "a=" + (active ? "recvonly" : "inactive"));
            })
            .join("")
    );
}

// add SDP RTP header extension mapping
export function addExtMap(sdp, extmapUri, modifyAudio = false, modifyVideo = false) {
    try {
        const sdpObj = sdpTransform.parse(sdp);

        // in case session level extmaps we skip modification
        // TODO: handle it more properly
        if (sdpObj?.ext?.length > 0) {
            return sdp;
        }

        // if sdp string is faulty, and lib can't parse any m= lines we return it unmodified.
        if (sdpObj?.media.length < 1) return sdp;

        const allHeaderExtensions = sdpObj?.media.flatMap((section) => section.ext || []);
        const extmapId =
            allHeaderExtensions.find((ext) => ext.uri === extmapUri)?.value ||
            [...new Set([0, 15, ...allHeaderExtensions.map((ext) => ext.value)])]
                .sort((a, b) => a - b)
                .find((n, i, arr) => n + 1 !== arr[i + 1]) + 1;

        sdpObj.media.forEach((mediaSection) => {
            if ((modifyAudio && mediaSection.type === "audio") || (modifyVideo && mediaSection.type === "video")) {
                if (!mediaSection.ext?.find((e) => e.uri === extmapUri)) {
                    if (Array.isArray(mediaSection.ext)) {
                        mediaSection["ext"].push({ value: extmapId, uri: extmapUri });
                    } else {
                        mediaSection["ext"] = [{ value: extmapId, uri: extmapUri }];
                    }
                }
            }
        });
        return sdpTransform.write(sdpObj);
    } catch (error) {
        console.error("Error during addAbsCaptureTimeExtMap: ", error);
    }
    return sdp;
}

// Add SDP RTP header extension mapping to abs-capture-time
// a=extmap:9 http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time
export function addAbsCaptureTimeExtMap(sdp) {
    const absCaptureTimeUri = "http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time";
    return addExtMap(sdp, absCaptureTimeUri, true, true);
}
