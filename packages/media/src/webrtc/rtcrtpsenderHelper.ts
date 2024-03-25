// use https://w3c.github.io/webrtc-pc/#dom-rtcrtpsender-setparameters to change the video bandwidth.
export function setVideoBandwidthUsingSetParameters(pc: any, bandwidth: any, logger: any = console) {
    const sender = pc.getSenders().find((s: any) => s.track && s.track.kind === "video");
    if (!sender) {
        return Promise.resolve();
    }

    const parameters = sender.getParameters();
    if (parameters.encodings && parameters.encodings.length === 0) {
        return Promise.resolve();
    }

    if (!parameters.encodings) {
        // workaround for Firefox
        parameters.encodings = [{}];
    }

    if (bandwidth === 0) {
        delete parameters.encodings[0].maxBitrate;
    } else {
        parameters.encodings[0].maxBitrate = bandwidth * 1000; // convert to bps
    }

    return sender.setParameters(parameters).catch((err: any) => {
        logger.error("setParameters err: ", err);
    });
}
