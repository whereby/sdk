import * as helpers from "./webRtcHelpers";
import * as mediasoupClient from "mediasoup-client";

import * as CONNECTION_STATUS from "../../src/model/connectionStatusConstants";
import VegaRtcManager from "../../src/webrtc/VegaRtcManager";

const originalNavigator = global.navigator;
const originalMediasoupDevice = mediasoupClient.Device;

describe("VegaRtcManager", () => {
    let navigator;
    let serverSocketStub;
    let serverSocket;
    let emitter;
    let webrtcProvider;
    let mediaContstraints;

    let rtcManager;

    beforeEach(() => {
        serverSocketStub = helpers.createServerSocketStub();
        serverSocket = serverSocketStub.socket;
        webrtcProvider = {
            webRtcDetectedBrowser: "chrome",
            webRtcDetectedBrowserVersion: "60",
            getMediaConstraints: () => mediaContstraints,
        };

        emitter = helpers.createEmitterStub();

        navigator = {
            mediaDevices: {
                getUserMedia: () => {
                    throw "must be stubbed";
                },
            },
        };

        Object.defineProperty(global, "navigator", {
            value: navigator,
        });

        Object.defineProperty(mediasoupClient, "Device", {
            value: sinon.stub(),
        });

        rtcManager = new VegaRtcManager({
            selfId: helpers.randomString("client-"),
            room: { iceServers: [] },
            emitter,
            serverSocket,
            webrtcProvider,
            features: {},
            eventClaim: helpers.randomString("/claim-"),
        });
    });

    afterEach(() => {
        Object.defineProperty(global, "navigator", {
            value: originalNavigator,
        });
        Object.defineProperty(mediasoupClient, "Device", {
            value: originalMediasoupDevice,
        });
    });

    describe("stopOrResumeVideo", () => {
        let clock;
        let localStream;

        beforeEach(() => {
            clock = sinon.useFakeTimers();
            localStream = helpers.createMockedMediaStream();
        });

        afterEach(() => {
            clock.restore();
        });

        describe("when disabling", () => {
            it("should stop the video track after 5 seconds", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = false;

                rtcManager.stopOrResumeVideo(localStream, false);

                expect(videoTrack.stop).not.to.have.been.called();
                clock.tick(5000);
                expect(videoTrack.stop).to.have.been.called();
            });

            it("should NOT stop track if it is still enabled", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = true;

                rtcManager.stopOrResumeVideo(localStream, false);

                expect(videoTrack.stop).not.to.have.been.called();
                clock.tick(5000);
                expect(videoTrack.stop).not.to.have.been.called();
            });

            it("should remove the track from local stream", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = false;

                rtcManager.stopOrResumeVideo(localStream, false);
                clock.tick(5000);

                expect(localStream.removeTrack).to.have.been.calledWithExactly(videoTrack);
            });

            it("should emit event", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = false;

                rtcManager.stopOrResumeVideo(localStream, false);
                clock.tick(5000);

                expect(emitter.emit).to.have.been.calledWithExactly(
                    CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_REMOVED,
                    {
                        stream: localStream,
                        track: videoTrack,
                    }
                );
            });
        });

        describe("when enabling", () => {
            let gumStream;
            let gumStub;

            beforeEach(() => {
                gumStream = helpers.createMockedMediaStream();
                gumStub = sinon.stub(navigator.mediaDevices, "getUserMedia").resolves(gumStream);
                localStream.removeTrack(localStream.getVideoTracks()[0]);
            });

            afterEach(() => {
                gumStub.restore();
            });

            it("should obtain new video track with existing constraints", () => {
                mediaContstraints = { video: { some: "constraint" } };

                rtcManager.stopOrResumeVideo(localStream, true);

                expect(navigator.mediaDevices.getUserMedia).to.have.been.calledWithExactly({
                    video: mediaContstraints.video,
                });
            });

            it("should add video track to local stream", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(localStream.addTrack).to.have.been.calledWithExactly(expectedTrack);
            });

            it("should emit event", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(emitter.emit).to.have.been.calledWithExactly(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_ADDED, {
                    streamId: localStream.id,
                    tracks: [expectedTrack],
                    screenShare: false,
                });
            });

            it("should sendWebcam(track)", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];
                sinon.spy(rtcManager, "_sendWebcam");

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(rtcManager._sendWebcam).to.have.been.calledWithExactly(expectedTrack);
            });
        });
    });
});
