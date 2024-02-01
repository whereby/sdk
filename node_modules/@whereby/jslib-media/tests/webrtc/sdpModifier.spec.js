import * as sdpModifier from "../../src/webrtc/sdpModifier";

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
});
