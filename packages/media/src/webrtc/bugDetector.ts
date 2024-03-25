import adapterRaw from "webrtc-adapter";

// @ts-ignore
const adapter = adapterRaw.default ?? adapterRaw;

/**
 * Detect mic issue which seems to happen on OSX when the computer is woken up and sleeping
 * frequently. A browser restart fixes this.
 *
 * Should be called after the connection has been up for a while.
 *
 * @see Bug report {@link https://bugs.chromium.org/p/webrtc/issues/detail?id=4799}
 */
export function detectMicrophoneNotWorking(pc: any) {
    if (
        adapter.browserDetails.browser !== "chrome" ||
        // @ts-ignore
        adapter.browserDetails.browser < 58 || // legacy getStats is no longer supported.
        pc.signalingState === "closed"
    ) {
        return Promise.resolve(false);
    }
    const sendingAudio = pc.getSenders().some((sender: any) => sender.track && sender.track.kind === "audio");
    const receivingAudio = pc.getReceivers().some((receiver: any) => receiver.track && receiver.track.kind === "audio");
    return pc.getStats(null).then((result: any) => {
        let microphoneFailed: any = false;
        result.forEach((report: any) => {
            if (
                report.type === "outbound-rtp" &&
                (report.kind === "audio" || report.mediaType === "audio") &&
                sendingAudio
            ) {
                if (report.bytesSent === 0) {
                    microphoneFailed = "outbound";
                }
            } else if (
                report.type === "inbound-rtp" &&
                (report.kind === "audio" || report.mediaType === "audio") &&
                receivingAudio
            ) {
                if (report.bytesReceived === 0) {
                    microphoneFailed = "inbound";
                }
            }
        });
        return microphoneFailed;
    });
}
