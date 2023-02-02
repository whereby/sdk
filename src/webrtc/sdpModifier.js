import SDPUtils from "sdp";
import adapter from "webrtc-adapter";

const browserName = adapter.browserDetails.browser;
const browserVersion = adapter.browserDetails.version;

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
