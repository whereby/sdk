import VegaRtcManager from "../";

import * as CONNECTION_STATUS from "../../../model/connectionStatusConstants";
import * as helpers from "../../../../tests/webrtc/webRtcHelpers";
import { MockTransport, MockProducer } from "../../../../tests/webrtc/webRtcHelpers";
import WS from "jest-websocket-mock";
import { setTimeout } from "timers/promises";
import { GetConstraintsOptions, WebRTCProvider } from "../../types";

jest.mock("../../../utils/getMediasoupDevice");
const { getMediasoupDeviceAsync } = jest.requireMock("../../../utils/getMediasoupDevice");

jest.mock("webrtc-adapter", () => {
    return {
        browserDetails: { browser: "chrome" },
    };
});

const originalNavigator = global.navigator;

describe("VegaRtcManager", () => {
    let navigator: any;
    let serverSocketStub: any;
    let serverSocket: any;
    let emitter: any;
    let webrtcProvider: WebRTCProvider;
    let mediaConstraints: GetConstraintsOptions;

    let rtcManager: VegaRtcManager;
    let sfuWebsocketServer: WS;
    let sfuWebsocketServerUrl: string;

    let mockSendTransport: MockTransport;

    beforeEach(() => {
        mediaConstraints = {
            devices: [],
            options: {
                disableAEC: false,
                disableAGC: false,
                hd: false,
                lax: false,
                lowDataMode: false,
                simulcast: false,
                widescreen: false,
            },
        };
        const server = helpers.createSfuWebsocketServer();
        sfuWebsocketServer = server.wss;
        sfuWebsocketServerUrl = server.url;
        serverSocketStub = helpers.createServerSocketStub();
        serverSocket = serverSocketStub.socket;
        webrtcProvider = {
            getMediaConstraints: () => mediaConstraints,
        };
        mockSendTransport = new MockTransport();

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

        getMediasoupDeviceAsync.mockImplementation(() => ({
            load: jest.fn(),
            rtpCapabilities: {},
            createSendTransport: () => mockSendTransport,
            createRecvTransport: () => new MockTransport(),
        }));

        rtcManager = new VegaRtcManager({
            selfId: helpers.randomString("client-"),
            room: {
                iceServers: {
                    iceServers: [],
                },
                sfuServer: { url: sfuWebsocketServerUrl },
                name: "name",
                organizationId: "id",
                isClaimed: true,
                clients: [],
                isLocked: false,
                knockers: [],
                mediaserverConfigTtlSeconds: 3600,
                mode: "group",
                spotlights: [],
                session: null,
                turnServers: [],
            },
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
    });

    describe("constructor", () => {
        const selfId = helpers.randomString("client-");

        it("gets a mediasoup device", async () => {
            const device = jest.fn();
            getMediasoupDeviceAsync.mockImplementation(() => device);

            const rtcManager = new VegaRtcManager({
                selfId,
                eventClaim: "claim",
                room: {
                    name: helpers.randomString("/room-"),
                    turnServers: [],
                    clients: [],
                    isLocked: false,
                    isClaimed: false,
                    iceServers: {
                        iceServers: [],
                    },
                    knockers: [],
                    mediaserverConfigTtlSeconds: 0,
                    mode: "group",
                    organizationId: "",
                    spotlights: [],
                    session: null,
                },
                emitter,
                serverSocket,
                webrtcProvider,
                features: { isNodeSdk: true },
            });

            expect(getMediasoupDeviceAsync).toHaveBeenCalledWith({ isNodeSdk: true });
            expect(await rtcManager._mediasoupDeviceInitializedAsync).toEqual(device);
        });
    });

    describe("addCameraStream", () => {
        it("should not produce ended webcam track", async () => {
            const stream = helpers.createMockedMediaStream();
            jest.spyOn(mockSendTransport, "produce");
            stream.getTracks().forEach((t) => {
                // @ts-ignore
                if (t.kind === "video") t.readyState = "ended";
                else stream.removeTrack(t);
            });
            rtcManager.setupSocketListeners();
            rtcManager.addCameraStream(stream);
            await setTimeout(100);

            expect(mockSendTransport.produce).toHaveBeenCalledTimes(0);
            sfuWebsocketServer.close();
        });
    });

    describe("replaceTrack", () => {
        let stream: MediaStream;
        let newTrack: MediaStreamTrack;

        beforeEach(() => {
            stream = helpers.createMockedMediaStream();
            newTrack = helpers.createMockedMediaStreamTrack({
                id: "id",
                kind: "video",
            });
        });

        it("should not create duplicate producers", async () => {
            const oldTrack = stream.getVideoTracks()[0];
            const mockVideoProducer = new MockProducer({ kind: "video" });
            jest.spyOn(mockVideoProducer, "replaceTrack");
            jest.spyOn(mockSendTransport, "produce").mockImplementation(({ track }: { track: MediaStreamTrack }) => {
                if (track.kind === "video") return mockVideoProducer;
                else return new MockProducer({ kind: "audio" });
            });

            rtcManager.setupSocketListeners();
            rtcManager.addCameraStream(stream);
            rtcManager.replaceTrack(oldTrack, newTrack);
            await setTimeout(250);

            expect(mockSendTransport.produce).toHaveBeenCalledTimes(2);
            expect(mockVideoProducer.replaceTrack).toHaveBeenCalledTimes(1);
            expect(mockVideoProducer.replaceTrack).toHaveBeenCalledWith({ track: newTrack });
            sfuWebsocketServer.close();
        });

        it("should handle transport not being connected yet", async () => {
            const oldTrack = stream.getVideoTracks()[0];
            const mockVideoProducer = new MockProducer({ kind: "video" });
            jest.spyOn(mockVideoProducer, "replaceTrack");
            jest.spyOn(mockSendTransport, "produce").mockImplementation(({ track }: { track: MediaStreamTrack }) => {
                if (track.kind === "video") return mockVideoProducer;
                else return new MockProducer({ kind: "audio" });
            });

            rtcManager.addCameraStream(stream);
            rtcManager.replaceTrack(oldTrack, newTrack);
            await setTimeout(100);
            rtcManager.setupSocketListeners();
            await setTimeout(250);

            expect(mockSendTransport.produce).toHaveBeenCalledTimes(2);
            expect(mockVideoProducer.replaceTrack).toHaveBeenCalledTimes(1);
            expect(mockVideoProducer.replaceTrack).toHaveBeenCalledWith({ track: newTrack });
            sfuWebsocketServer.close();
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
            let deviceId: string;

            beforeEach(() => {
                gumStream = helpers.createMockedMediaStream();
                global.navigator.mediaDevices.getUserMedia = jest.fn(() => Promise.resolve(gumStream));
                deviceId = helpers.randomString();
                mediaConstraints.videoId = deviceId;
                mediaConstraints.devices = [
                    helpers.createMockedInputDevice("videoinput", { deviceId, label: helpers.randomString() }),
                ];

                localStream.removeTrack(localStream.getVideoTracks()[0]);
            });

            it("should obtain new video track using constraints from webrtcProvider", () => {
                const gumSpy = jest.spyOn(global.navigator.mediaDevices, "getUserMedia");
                rtcManager.stopOrResumeVideo(localStream, true);

                // @ts-ignore
                expect(gumSpy.mock.calls[0][0]?.video?.deviceId?.ideal).toBe(deviceId);
            });

            it("should add video track to local stream", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];

                rtcManager.stopOrResumeVideo(localStream, true);

                jest.advanceTimersToNextTimerAsync();
                await new Promise(process.nextTick);

                expect(localStream.addTrack).toHaveBeenCalledWith(expectedTrack);
            });

            it("should emit event", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];

                rtcManager.stopOrResumeVideo(localStream, true);

                jest.advanceTimersToNextTimerAsync();
                await new Promise(process.nextTick);

                expect(emitter.emit).toHaveBeenCalledWith(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_ADDED, {
                    streamId: localStream.id,
                    tracks: [expectedTrack],
                    screenShare: false,
                });
            });

            it("should sendWebcam(track)", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];
                jest.spyOn(rtcManager, "_sendWebcam");

                rtcManager.stopOrResumeVideo(localStream, true);

                jest.advanceTimersToNextTimerAsync();
                await new Promise(process.nextTick);

                expect(rtcManager._sendWebcam).toHaveBeenCalledWith(expectedTrack);
            });
        });
    });

    describe("handling localStream `stopresumevideo` event", () => {
        let stream: any;

        beforeEach(() => {
            stream = helpers.createMockedMediaStream();
            rtcManager.addCameraStream(stream, { audioPaused: false, videoPaused: false });
        });

        describe("when enable", () => {
            it("should _sendWebcam with the new track", () => {
                jest.spyOn(rtcManager, "_sendWebcam");
                const track = helpers.createMockedMediaStreamTrack({ kind: "video" });

                stream.dispatchEvent(new CustomEvent("stopresumevideo", { detail: { enable: true, track } }));

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
                    stream.dispatchEvent(new CustomEvent("stopresumevideo", { detail: { enable: false, track } }));

                    expect(rtcManager._stopProducer).toHaveBeenCalledWith(webcamProducer);
                });

                it("should not keep track of the old producer", () => {
                    stream.dispatchEvent(new CustomEvent("stopresumevideo", { detail: { enable: false, track } }));

                    expect(rtcManager._webcamProducer).toEqual(null);
                });
            });
        });
    });

    describe("disconnectAll", () => {
        it("closes the VegaQualityMonitor connection", () => {
            jest.spyOn(rtcManager._qualityMonitor, "close");

            rtcManager.disconnectAll();

            expect(rtcManager._qualityMonitor.close).toHaveBeenCalled();
        });
    });
});
