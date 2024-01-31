import * as sdpModifier from "../../src/webrtc/sdpModifier";
import SDPUtils from "sdp";

describe("sdpModifier", () => {
    const videoSdpLines = [
        "v=0",
        "o=jdoe 2890844526 2890842807 IN IP4 10.0.1.1",
        "s=",
        "t=0 0",
        "a=ice-pwd:asd88fgpdd777uzjYhagZg",
        "a=ice-ufrag:8hhY",
        "m=video 45664 RTP/AVP 100",
        "c=IN IP4 192.0.2.3",
        "a=rtpmap:100 VP8/90000",
    ];

    function getVideoSdpString() {
        return videoSdpLines.join("\r\n") + "\r\n";
    }

    describe("changeMediaDirection", () => {
        it("changes the direction to inactive when active is set to false", () => {
            const initialSdp = getVideoSdpString() + "a=recvonly\r\n";
            const modifiedSdp = sdpModifier.changeMediaDirection(initialSdp, false);
            expect(modifiedSdp).toEqual(initialSdp.replace("recvonly", "inactive"));
        });
        it("changes the direction to recvonly when active is set to true", () => {
            const initialSdp = getVideoSdpString() + "a=inactive\r\n";
            const modifiedSdp = sdpModifier.changeMediaDirection(initialSdp, true);
            expect(modifiedSdp).toEqual(initialSdp.replace("inactive", "recvonly"));
        });
    });

    describe("deprioritizeH264", () => {
        const sdp =
            "v=0\r\n" +
            "o=- 166855176514521964 2 IN IP4 127.0.0.1\r\n" +
            "s=-\r\n" +
            "t=0 0\r\n" +
            "a=group:BUNDLE a v1 v2\r\n" +
            "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n" +
            "a=mid:audio\r\n" +
            "a=msid:stream1 audiotrack\r\n" +
            "a=ssrc:1001 cname:some\r\n" +
            "m=video 9 UDP/TLS/RTP/SAVPF 90 91 92 93\r\n" +
            "a=mid:video\r\n" +
            "a=msid:stream1 videotrack\r\n" +
            "a=ssrc:1002 cname:some\r\n" +
            "a=rtpmap:90 H264/90000\r\n" +
            "a=rtpmap:91 VP8/90000\r\n" +
            "a=rtpmap:92 h264/90000\r\n" +
            "a=rtpmap:93 vp9/90000\r\n" +
            "m=video 9 UDP/TLS/RTP/SAVPF 111\r\n" +
            "a=mid:screen\r\n" +
            "a=msid:stream2 screentrack\r\n" +
            "a=ssrc:1003 cname:some\r\n";

        it("moves h264 payloads to end of m-line", () => {
            const modifedSdp = sdpModifier.deprioritizeH264(sdp);
            expect(modifedSdp).toContain("m=video 9 UDP/TLS/RTP/SAVPF 91 93 90 92\r\n");
        });

        it("ignores m-lines without h264 payloads", () => {
            const modifedSdp = sdpModifier.deprioritizeH264(sdp);
            expect(modifedSdp).toContain("m=video 9 UDP/TLS/RTP/SAVPF 111\r\n");
        });
    });

    describe("add RTP Header Extension", () => {
        const createSdpFromExtmap = (extmap) => {
            return (
                "v=0\r\n" +
                "o=- 3699601008446741681 2 IN IP4 127.0.0.1\r\n" +
                "s=-\r\n" +
                "t=0 0\r\n" +
                "a=group:BUNDLE 0 1\r\n" +
                "a=extmap-allow-mixed\r\n" +
                (extmap["session"] ? extmap["session"].join("") : "") +
                "m=audio 8337 UDP/TLS/RTP/SAVPF 111\r\n" +
                "c=IN IP4 52.19.129.231\r\n" +
                "a=rtcp:9 IN IP4 0.0.0.0\r\n" +
                "a=fingerprint:sha-256 2F:50:3C:E5:ED:C2:2F:61:2B:7F:5D:8A:32:60:62:AC:FE:79:53:9E:90:F4:4D:71:E0:A1:11:CB:79:5C:6F:53\r\n" +
                "a=mid:0\r\n" +
                (extmap["audio"] ? extmap["audio"].join("") : "") +
                "a=sendrecv\r\n" +
                "a=rtcp-mux\r\n" +
                "a=rtpmap:111 opus/48000/2\r\n" +
                "a=rtcp-fb:111 transport-cc\r\n" +
                "a=fmtp:111 minptime=10;useinbandfec=1\r\n" +
                "m=video 2121 UDP/TLS/RTP/SAVPF 45\r\n" +
                "c=IN IP4 52.19.129.231\r\n" +
                "a=rtcp:9 IN IP4 0.0.0.0\r\n" +
                "a=fingerprint:sha-256 2F:50:3C:E5:ED:C2:2F:61:2B:7F:5D:8A:32:60:62:AC:FE:79:53:9E:90:F4:4D:71:E0:A1:11:CB:79:5C:6F:53\r\n" +
                "a=mid:1\r\n" +
                (extmap["video"] ? extmap["video"].join("") : "") +
                "a=sendrecv\r\n" +
                "a=rtcp-mux\r\n" +
                "a=rtcp-rsize\r\n" +
                "a=rtpmap:45 AV1/90000\r\n" +
                "a=rtcp-fb:45 goog-remb\r\n" +
                "a=rtcp-fb:45 transport-cc\r\n" +
                "a=rtcp-fb:45 ccm fir\r\n" +
                "a=rtcp-fb:45 nack\r\n" +
                "a=rtcp-fb:45 nack pli\r\n"
            );
        };
        it("Add RTP header extension map abs-capture-time only to video", () => {
            const extmap = {
                audio: [
                    "a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\n",
                    "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n",
                    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n",
                    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\n",
                ],
                video: [
                    "a=extmap:14 urn:ietf:params:rtp-hdrext:toffset\r\n",
                    "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n",
                    "a=extmap:13 urn:3gpp:video-orientation\r\n",
                    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n",
                    "a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r\n",
                    "a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r\n",
                    "a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r\n",
                    "a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space\r\n",
                    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\n",
                    "a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id\r\n",
                    "a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id\r\n",
                ],
            };
            const modifedSdp = sdpModifier.addExtMap(
                createSdpFromExtmap(extmap),
                "http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time",
                true,
                false
            );
            const sections = SDPUtils.splitSections(modifedSdp);
            sections.forEach((mediaSection) => {
                const kind = SDPUtils.getKind(mediaSection);
                ["audio", "video"].forEach((media) => {
                    if (kind === media) {
                        if (kind === "audio") {
                            expect(mediaSection).toContain(
                                "a=extmap:9 http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time\r\n"
                            );
                        }
                        if (kind === "video") {
                            expect(mediaSection).not.toContain(
                                "a=extmap:9 http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time\r\n"
                            );
                        }
                        extmap[media].forEach((extmap) => {
                            expect(mediaSection).toContain(extmap);
                        });
                    }
                });
            });
        });

        it("Add RTP header extension map abs-capture-time no ext map id=1", () => {
            const extmap = { audio: [], video: [] };
            const modifedSdp = sdpModifier.addAbsCaptureTimeExtMap(createSdpFromExtmap(extmap));
            const sections = SDPUtils.splitSections(modifedSdp);
            sections.forEach((mediaSection) => {
                const kind = SDPUtils.getKind(mediaSection);
                if (kind === "audio" || kind === "video") {
                    expect(mediaSection).toContain(
                        "a=extmap:1 http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time\r\n"
                    );
                }
            });
        });

        it("Add RTP header extension map abs-capture-time id=9", () => {
            const extmap = {
                audio: [
                    "a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\n",
                    "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n",
                    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n",
                    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\n",
                ],
                video: [
                    "a=extmap:14 urn:ietf:params:rtp-hdrext:toffset\r\n",
                    "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n",
                    "a=extmap:13 urn:3gpp:video-orientation\r\n",
                    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n",
                    "a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r\n",
                    "a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r\n",
                    "a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r\n",
                    "a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space\r\n",
                    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\n",
                    "a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id\r\n",
                    "a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id\r\n",
                ],
            };
            const modifedSdp = sdpModifier.addAbsCaptureTimeExtMap(createSdpFromExtmap(extmap));
            const sections = SDPUtils.splitSections(modifedSdp);
            sections.forEach((mediaSection) => {
                const kind = SDPUtils.getKind(mediaSection);
                ["audio", "video"].forEach((media) => {
                    if (kind === media) {
                        expect(mediaSection).toContain(
                            "a=extmap:9 http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time\r\n"
                        );
                        extmap[media].forEach((extmap) => {
                            expect(mediaSection).toContain(extmap);
                        });
                    }
                });
            });
        });

        it("Add RTP header extension map abs-capture-time id=12", () => {
            const extmap = {
                audio: [
                    "a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\n",
                    "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n",
                    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n",
                    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\n",
                ],
                video: [
                    "a=extmap:9 urn:ietf:params:rtp-hdrext:toffset\r\n",
                    "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n",
                    "a=extmap:13 urn:3gpp:video-orientation\r\n",
                    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n",
                    "a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r\n",
                    "a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r\n",
                    "a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r\n",
                    "a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space\r\n",
                    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\n",
                    "a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id\r\n",
                    "a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id\r\n",
                ],
            };
            const modifedSdp = sdpModifier.addAbsCaptureTimeExtMap(createSdpFromExtmap(extmap));
            const sections = SDPUtils.splitSections(modifedSdp);
            sections.forEach((mediaSection) => {
                const kind = SDPUtils.getKind(mediaSection);
                ["audio", "video"].forEach((media) => {
                    if (kind === media) {
                        expect(mediaSection).toContain(
                            "a=extmap:12 http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time\r\n"
                        );
                        extmap[media].forEach((extmap) => {
                            expect(mediaSection).toContain(extmap);
                        });
                    }
                });
            });
        });
        it("Add RTP header extension map abs-capture-time (skip reserved 15) id=16", () => {
            const extmap = {
                audio: [
                    "a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\n",
                    "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n",
                    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n",
                    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\n",
                    "a=extmap:12 http://www.webrtc.org/experiments/rtp-hdrext/inband-c\r\n",
                ],
                video: [
                    "a=extmap:9 urn:ietf:params:rtp-hdrext:toffset\r\n",
                    "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n",
                    "a=extmap:13 urn:3gpp:video-orientation\r\n",
                    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n",
                    "a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r\n",
                    "a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r\n",
                    "a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r\n",
                    "a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space\r\n",
                    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\n",
                    "a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id\r\n",
                    "a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id\r\n",
                    "a=extmap:14 http://www.webrtc.org/experiments/rtp-hdrext/video-layers-allocation00",
                ],
            };
            const modifedSdp = sdpModifier.addAbsCaptureTimeExtMap(createSdpFromExtmap(extmap));
            const sections = SDPUtils.splitSections(modifedSdp);
            sections.forEach((mediaSection) => {
                const kind = SDPUtils.getKind(mediaSection);
                ["audio", "video"].forEach((media) => {
                    if (kind === media) {
                        expect(mediaSection).toContain(
                            "a=extmap:16 http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time\r\n"
                        );
                        extmap[media].forEach((extmap) => {
                            expect(mediaSection).toContain(extmap);
                        });
                    }
                });
            });
        });
        it("Add RTP header extension map abs-capture-time (skip reserved 15) id=17", () => {
            const extmap = {
                audio: [
                    "a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\n",
                    "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n",
                    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n",
                    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\n",
                    "a=extmap:12 http://www.webrtc.org/experiments/rtp-hdrext/inband-c\r\n",
                ],
                video: [
                    "a=extmap:9 urn:ietf:params:rtp-hdrext:toffset\r\n",
                    "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n",
                    "a=extmap:13 urn:3gpp:video-orientation\r\n",
                    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n",
                    "a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r\n",
                    "a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r\n",
                    "a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r\n",
                    "a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space\r\n",
                    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\n",
                    "a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id\r\n",
                    "a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id\r\n",
                    "a=extmap:14 http://www.webrtc.org/experiments/rtp-hdrext/video-layers-allocation00\r\n",
                    "a=extmap:16 http://www.webrtc.org/experiments/rtp-hdrext/video-layers-allocation01",
                ],
            };
            const modifedSdp = sdpModifier.addAbsCaptureTimeExtMap(createSdpFromExtmap(extmap));
            const sections = SDPUtils.splitSections(modifedSdp);
            sections.forEach((mediaSection) => {
                const kind = SDPUtils.getKind(mediaSection);
                ["audio", "video"].forEach((media) => {
                    if (kind === media) {
                        expect(mediaSection).toContain(
                            "a=extmap:17 http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time\r\n"
                        );
                        extmap[media].forEach((extmap) => {
                            expect(mediaSection).toContain(extmap);
                        });
                    }
                });
            });
        });
        it("Uses existing RTP header extension map abs-capture-time id=6", () => {
            const extmap = {
                audio: [
                    "a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\n",
                    "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n",
                    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n",
                    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\n",
                    "a=extmap:12 http://www.webrtc.org/experiments/rtp-hdrext/inband-c\r\n",
                ],
                video: [
                    "a=extmap:9 urn:ietf:params:rtp-hdrext:toffset\r\n",
                    "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n",
                    "a=extmap:13 urn:3gpp:video-orientation\r\n",
                    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n",
                    "a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r\n",
                    "a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time\r\n",
                    "a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r\n",
                    "a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space\r\n",
                    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\n",
                    "a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id\r\n",
                    "a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id\r\n",
                    "a=extmap:14 http://www.webrtc.org/experiments/rtp-hdrext/video-layers-allocation00\r\n",
                    "a=extmap:16 http://www.webrtc.org/experiments/rtp-hdrext/video-layers-allocation01",
                ],
            };
            const modifedSdp = sdpModifier.addAbsCaptureTimeExtMap(createSdpFromExtmap(extmap));
            const sections = SDPUtils.splitSections(modifedSdp);
            sections.forEach((mediaSection) => {
                const kind = SDPUtils.getKind(mediaSection);
                ["audio", "video"].forEach((media) => {
                    if (kind === media) {
                        expect(mediaSection).toContain(
                            "a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time\r\n"
                        );
                        extmap[media].forEach((extmap) => {
                            expect(mediaSection).toContain(extmap);
                        });
                    }
                });
            });
        });
        it("We don't modify session level RTP header extension map just give back origin sdp", () => {
            const extmap = {
                session: [
                    "a=extmap:1 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n",
                    "a=extmap:2 urn:ietf:params:rtp-hdrext:sdes:mid\r\n",
                ],
            };
            const sdp = createSdpFromExtmap(extmap);
            const modifedSdp = sdpModifier.addAbsCaptureTimeExtMap(sdp);
            expect(modifedSdp).toEqual(sdp);
        });
        const faultySDPs = [42, null, undefined, "!NotSDP String!"];
        faultySDPs.forEach((sdp) => {
            it(
                "Try to add an RTP header extension, when sdp=" + sdp + ". Any faulty SDP gives back the origin SDP",
                () => {
                    const modifedSdp = sdpModifier.addAbsCaptureTimeExtMap(sdp);
                    expect(modifedSdp).toEqual(sdp);
                }
            );
        });
    });
});
