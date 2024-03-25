import * as helpers from "./webRtcHelpers";
import * as mediasoupClient from "mediasoup-client";

jest.mock("webrtc-adapter", () => {
    return {
        browserDetails: { browser: "chrome" },
    };
});

import * as CONNECTION_STATUS from "../../src/model/connectionStatusConstants";
import VegaRtcManager from "../../src/webrtc/VegaRtcManager";
import { itShouldThrowIfMissing } from "../helpers";

const originalNavigator = global.navigator;
const originalMediasoupDevice = mediasoupClient.Device;

describe("VegaRtcManager", () => {
    let navigator: any;
    let serverSocketStub: any;
    let serverSocket: any;
    let emitter: any;
    let webrtcProvider: any;
    let mediaContstraints: any;

    let rtcManager: any;

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
            value: jest.fn(),
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

    describe("constructor", () => {
        const selfId = helpers.randomString("client-");
        const room = { name: helpers.randomString("/room-"), iceServers: {} };

        it("handles custom device handler factories", () => {
            const deviceHandlerFactory = function () {};
            jest.mock("mediasoup-client", () => {
                return {
                    Device: jest.fn().mockImplementation(() => {
                        return {};
                    }),
                };
            });
            //eslint-disable-next-line no-new
            new VegaRtcManager({
                selfId,
                room,
                emitter,
                serverSocket,
                webrtcProvider,
                deviceHandlerFactory,
            });
            expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerFactory: deviceHandlerFactory });
        });
    });

    describe("stopOrResumeVideo", () => {
        let localStream: any;

        beforeEach(() => {
            jest.useFakeTimers();
            localStream = helpers.createMockedMediaStream();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        describe("when disabling", () => {
            it("should stop the video track after 5 seconds", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = false;

                rtcManager.stopOrResumeVideo(localStream, false);

                expect(videoTrack.stop).toHaveBeenCalledTimes(0);
                jest.advanceTimersByTime(5000);
                expect(videoTrack.stop).toHaveBeenCalledTimes(1);
            });

            it("should NOT stop track if it is still enabled", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = true;

                rtcManager.stopOrResumeVideo(localStream, false);

                expect(videoTrack.stop).toHaveBeenCalledTimes(0);
                jest.advanceTimersByTime(5000);
                expect(videoTrack.stop).toHaveBeenCalledTimes(0);
            });

            it("should remove the track from local stream", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = false;

                rtcManager.stopOrResumeVideo(localStream, false);
                jest.advanceTimersByTime(5000);

                expect(localStream.removeTrack).toHaveBeenCalledWith(videoTrack);
            });

            it("should emit event", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = false;

                rtcManager.stopOrResumeVideo(localStream, false);
                jest.advanceTimersByTime(5000);

                expect(emitter.emit).toHaveBeenCalledWith(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_REMOVED, {
                    stream: localStream,
                    track: videoTrack,
                });
            });
        });

        describe("when enabling", () => {
            let gumStream: any;

            beforeEach(() => {
                gumStream = helpers.createMockedMediaStream();
                global.navigator.mediaDevices.getUserMedia = jest.fn(() => Promise.resolve(gumStream));

                localStream.removeTrack(localStream.getVideoTracks()[0]);
            });

            it("should obtain new video track with existing constraints", () => {
                mediaContstraints = { video: { some: "constraint" } };

                rtcManager.stopOrResumeVideo(localStream, true);

                expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
                    video: mediaContstraints.video,
                });
            });

            it("should add video track to local stream", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];
                mediaContstraints = { video: { some: "constraint" } };

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(localStream.addTrack).toHaveBeenCalledWith(expectedTrack);
            });

            it("should emit event", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];
                mediaContstraints = { video: { some: "constraint" } };

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(emitter.emit).toHaveBeenCalledWith(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_ADDED, {
                    streamId: localStream.id,
                    tracks: [expectedTrack],
                    screenShare: false,
                });
            });

            it("should sendWebcam(track)", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];
                mediaContstraints = { video: { some: "constraint" } };
                jest.spyOn(rtcManager, "_sendWebcam");

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(rtcManager._sendWebcam).toHaveBeenCalledWith(expectedTrack);
            });
        });
    });

    describe("handling localStream `stopresumevideo` event", () => {
        let localStream: any;

        beforeEach(() => {
            localStream = helpers.createMockedMediaStream();
            rtcManager.addNewStream("0", localStream);
        });

        describe("when enable", () => {
            it("should _sendWebcam with the new track", () => {
                jest.spyOn(rtcManager, "_sendWebcam");
                const track = helpers.createMockedMediaStreamTrack({ kind: "video" });

                localStream.dispatchEvent(new CustomEvent("stopresumevideo", { detail: { enable: true, track } }));

                expect(rtcManager._sendWebcam).toHaveBeenCalledWith(track);
            });
        });

        describe("when disable", () => {
            describe("when there is already a webcam producer for the track", () => {
                let track: any;
                let webcamProducer: any;

                beforeEach(() => {
                    track = helpers.createMockedMediaStreamTrack({ kind: "video" });
                    webcamProducer = {
                        closed: false,
                        track,
                        pause: () => {
                            webcamProducer.paused = true;
                        },
                        resume: () => {
                            webcamProducer.paused = false;
                        },
                        paused: false,
                    };
                    rtcManager._webcamProducer = webcamProducer;
                    rtcManager._webcamPaused = false;
                    rtcManager._stopProducer = jest.fn();
                });

                it("should stop the webcam producer", () => {
                    localStream.dispatchEvent(new CustomEvent("stopresumevideo", { detail: { enable: false, track } }));

                    expect(rtcManager._stopProducer).toHaveBeenCalledWith(webcamProducer);
                });

                it("should not keep track of the old producer", () => {
                    localStream.dispatchEvent(new CustomEvent("stopresumevideo", { detail: { enable: false, track } }));

                    expect(rtcManager._webcamProducer).toEqual(null);
                });
            });
        });
    });
});
