import { IssueDetector } from "./issueDetectors";

const createQualityDetector = (type: "warning" | "critical") => {
    return {
        id: `quality-${type}`,
        // we're ignoring screenshares and outgoing streams for now
        enabled: ({ client }) => !client.isLocalClient && !client.isPresentation,
        check: ({ ssrc0, renderedDimensions, hasLiveTrack, kind }) => {
            // if there are no track, or no bitrate, we mark as quality issue
            // the client of these issues can ignore setup time for new videos by ignoring initial ticks
            if (!hasLiveTrack) return true;
            if (!ssrc0) return true;
            if (!ssrc0.bitrate) return true;

            // for incoming video we look at resolution, framerate, freezes and bitrate to detect quality issues
            if (kind === "video") {
                if (renderedDimensions && renderedDimensions.width && renderedDimensions.height) {
                    const maxSideRendered = Math.max(renderedDimensions.width, renderedDimensions.height);
                    const maxSideReceived = Math.max(ssrc0.width || 0, ssrc0.height || 0);

                    const fpsReceived = ssrc0.fps || 0;

                    // metrics/issue collection is run every 2s.
                    // we expect a framerate of at least 24fps for normal operation
                    // but consider 15 as the limit, as it is very common for many webcams to send 15fps in dim lightning
                    // a half second glitch/freeze in 30fps would result in a max calculated framerate of
                    // 26fps (since half of the lost frames might belong to previous sample)
                    // so it is not enough to look at framerate

                    // any number of freezes during interval we consider a freeze
                    // according to webrtc spec it is counted when it lasts for 3 or more frames considering
                    // current average framerate
                    //
                    // a freeze may start in previous sample and continue in next - and we assume
                    // we don't need to do anything special to detect 1 continous long freeze
                    // spanning multiple samples, as then it should show on framerate
                    const hadFreeze = !!ssrc0.freezeRate;

                    // even with good resolution+framerate, and no freezes, there can still be heavy compression
                    // we choose to verify the bitrate is at least above a low threshold for this.
                    // the qpSum in webrtc varies by codec, and possibly by content (lots of details changing),
                    // so we're not using it for now.
                    // we assume webrtc will use available bitrate even if sending video with little detail
                    const bitrate = ssrc0.bitrate || 0;

                    // targets minimum tile size (current max 80x80 in pwa?)
                    if (maxSideRendered < 100) {
                        // we expect lowest layer here, but accept a bit lower
                        // we expect 50% framerate, but even lower is ok when rendering as a tile
                        // we don't care about freezes that doesn't affect framerate

                        if (type === "warning" && maxSideReceived < 160) return true;
                        if (type === "critical" && maxSideReceived < 90) return true;

                        if (type === "warning" && fpsReceived < 5) return true;
                        if (type === "critical" && fpsReceived < 2) return true;

                        if (type === "warning" && bitrate < 10000) return true;
                        if (type === "critical" && bitrate < 5000) return true;
                    } else if (maxSideRendered < 480) {
                        // we expect lowest layer also here
                        // but here we care more about the quality and freezes
                        if (type === "warning" && maxSideReceived < 240) return true;
                        if (type === "critical" && maxSideReceived < 120) return true;

                        if (type === "warning" && fpsReceived < 14) return true;
                        if (type === "critical" && fpsReceived < 9) return true;

                        if (hadFreeze) return true;

                        if (type === "warning" && bitrate < 50000) return true;
                        if (type === "critical" && bitrate < 20000) return true;
                    } else {
                        // we expect middle or high resolution here
                        // we don't consider it a quality issue if receiving middle resolution
                        if (type === "warning" && maxSideReceived < 480) return true;
                        if (type === "critical" && maxSideReceived < 240) return true;

                        if (type === "warning" && fpsReceived < 14) return true;
                        if (type === "critical" && fpsReceived < 9) return true;

                        if (type === "warning" && bitrate < 200000) return true;
                        if (type === "critical" && bitrate < 50000) return true;

                        if (hadFreeze) return true;
                    }
                }
            } else if (kind === "audio") {
                // for audio we only consider distortion above thresholds as quality issue
                // bitrate might be close to 0 because of dtx, so we don't care about it
                // probably no way to detect crappy audio source without using ML

                const audioLevel = ssrc0.audioLevel || 0;
                const concealment = ssrc0.audioConcealment || 0;
                const acceleration = ssrc0.audioAcceleration || 0;
                const deceleration = ssrc0.audioDeceleration || 0;
                const audioDistortion = concealment + acceleration + deceleration;

                // how much distortion is noticeable? some say anything above 5% may.
                // some say it varies, samples in a row is worse than samples inbetween
                // modern versions using ML may handle it better then old etc.
                // testing at 5% it feels a bit trigger happy on packetloss that isn't affecting video
                // we try 10% for warning, 20% for critical

                // we only care if there is audio level
                if (audioLevel >= 0.01) {
                    if (type === "warning" && audioDistortion > 0.1) return true;
                    if (type === "critical" && audioDistortion > 0.2) return true;
                }
            }

            return false;
        },
    } as IssueDetector;
};

export const qualityWarningDetector = createQualityDetector("warning");
export const qualityCriticalDetector = createQualityDetector("critical");
