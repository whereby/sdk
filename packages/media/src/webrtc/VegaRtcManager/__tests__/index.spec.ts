import * as mediasoupClient from "mediasoup-client";

import VegaRtcManager from "../";

import * as CONNECTION_STATUS from "../../../model/connectionStatusConstants";
import * as helpers from "../../../../tests/webrtc/webRtcHelpers";
import { MockTransport, MockProducer } from "../../../../tests/webrtc/webRtcHelpers";
import { CustomMediaStreamTrack } from "../../types";
import WS from "jest-websocket-mock";
import Logger from "../../../utils/Logger";
import { setTimeout } from "timers/promises";

jest.mock("../../../utils/getHandler");
jest.mock("../../../utils/Safari17Handler");
const { getHandler } = jest.requireMock("../../../utils/getHandler");
const { Safari17 } = jest.requireMock("../../../utils/Safari17Handler");

const logger = new Logger();

jest.mock("webrtc-adapter", () => {
    return {
        browserDetails: { browser: "chrome" },
    };
});

const originalNavigator = global.navigator;
const originalMediasoupDevice = mediasoupClient.Device;

describe("VegaRtcManager", () => {
    let navigator: any;
    let serverSocketStub: any;
    let serverSocket: any;
    let emitter: any;
    let webrtcProvider: any;
    let mediaConstraints: any;

    let rtcManager: VegaRtcManager;
    let sfuWebsocketServer: WS;
    let sfuWebsocketServerUrl: string;

    let mockSendTransport: MockTransport;

    beforeEach(() => {
        const server = helpers.createSfuWebsocketServer();
        sfuWebsocketServer = server.wss;
        sfuWebsocketServerUrl = server.url;
        serverSocketStub = helpers.createServerSocketStub();
        serverSocket = serverSocketStub.socket;
        webrtcProvider = {
            webRtcDetectedBrowser: "chrome",
            webRtcDetectedBrowserVersion: "60",
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

        Object.defineProperty(mediasoupClient, "Device", {
            value: jest.fn().mockImplementation(() => {
                return {
                    load: jest.fn(),
                    rtpCapabilities: {},
                    createSendTransport: () => mockSendTransport,
                    createRecvTransport: () => new MockTransport(),
                };
            }),
        });

        rtcManager = new VegaRtcManager({
            selfId: helpers.randomString("client-"),
            room: {
                iceServers: [],
                sfuServer: { url: sfuWebsocketServerUrl },
                name: "name",
                organizationId: "id",
                isClaimed: true,
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
        Object.defineProperty(mediasoupClient, "Device", {
            value: originalMediasoupDevice,
        });
    });

    describe("constructor", () => {
        const selfId = helpers.randomString("client-");
        const room = { name: helpers.randomString("/room-"), iceServers: {} };

        it("handles custom device handler factories", () => {
            const deviceHandlerFactory = function () {};
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

        it("uses the custom Safari17 handler", () => {
            getHandler.mockImplementation(() => "Safari17");
            const factory = jest.fn();
            Safari17.createFactory.mockImplementation(() => factory);

            //eslint-disable-next-line no-new
            new VegaRtcManager({
                selfId,
                room,
                emitter,
                serverSocket,
                webrtcProvider,
            });

            expect(mediasoupClient.Device).toHaveBeenCalledWith({ handlerFactory: factory });
        });
    });

    describe("addNewStream", () => {
        it("should not produce ended webcam track", async () => {
            const localStream = helpers.createMockedMediaStream() as unknown as MediaStream;
            jest.spyOn(mockSendTransport, "produce");
            localStream.getTracks().forEach((t) => {
                // @ts-ignore
                if (t.kind === "video") t.readyState = "ended";
                else localStream.removeTrack(t);
            });
            rtcManager.setupSocketListeners();
            rtcManager.addNewStream("0", localStream, false, false);
            await setTimeout(100);

            expect(mockSendTransport.produce).toHaveBeenCalledTimes(0);
            sfuWebsocketServer.close();
        });
    });

    describe("replaceTrack", () => {
        let localStream: MediaStream;
        let newTrack: CustomMediaStreamTrack;

        beforeEach(() => {
            localStream = helpers.createMockedMediaStream() as unknown as MediaStream;
            newTrack = helpers.createMockedMediaStreamTrack({
                id: "id",
                kind: "video",
            }) as unknown as CustomMediaStreamTrack;
        });

        it("should not create duplicate producers", async () => {
            const oldTrack = localStream.getVideoTracks()[0];
            const mockVideoProducer = new MockProducer({ kind: "video" });
            jest.spyOn(mockVideoProducer, "replaceTrack");
            jest.spyOn(mockSendTransport, "produce").mockImplementation(({ track }: { track: MediaStreamTrack }) => {
                if (track.kind === "video") return mockVideoProducer;
                else return new MockProducer({ kind: "audio" });
            });

            rtcManager.setupSocketListeners();
            rtcManager.addNewStream("0", localStream, false, false);
            rtcManager.replaceTrack(oldTrack, newTrack);
            await setTimeout(250);

            expect(mockSendTransport.produce).toHaveBeenCalledTimes(2);
            expect(mockVideoProducer.replaceTrack).toHaveBeenCalledTimes(1);
            expect(mockVideoProducer.replaceTrack).toHaveBeenCalledWith({ track: newTrack });
            sfuWebsocketServer.close();
        });

        it("should handle transport not being connected yet", async () => {
            const oldTrack = localStream.getVideoTracks()[0];
            const mockVideoProducer = new MockProducer({ kind: "video" });
            jest.spyOn(mockVideoProducer, "replaceTrack");
            jest.spyOn(mockSendTransport, "produce").mockImplementation(({ track }: { track: MediaStreamTrack }) => {
                if (track.kind === "video") return mockVideoProducer;
                else return new MockProducer({ kind: "audio" });
            });

            rtcManager.addNewStream("0", localStream, false, false);
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

            beforeEach(() => {
                gumStream = helpers.createMockedMediaStream();
                global.navigator.mediaDevices.getUserMedia = jest.fn(() => Promise.resolve(gumStream));

                localStream.removeTrack(localStream.getVideoTracks()[0]);
            });

            it("should obtain new video track with existing constraints", () => {
                mediaConstraints = { video: { some: "constraint" } };

                rtcManager.stopOrResumeVideo(localStream, true);

                expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
                    video: mediaConstraints.video,
                });
            });

            it("should add video track to local stream", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];
                mediaConstraints = { video: { some: "constraint" } };

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(localStream.addTrack).toHaveBeenCalledWith(expectedTrack);
            });

            it("should emit event", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];
                mediaConstraints = { video: { some: "constraint" } };

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(emitter.emit).toHaveBeenCalledWith(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_ADDED, {
                    streamId: localStream.id,
                    tracks: [expectedTrack],
                    screenShare: false,
                });
            });

            it("should sendWebcam(track)", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];
                mediaConstraints = { video: { some: "constraint" } };
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
            rtcManager.addNewStream("0", localStream, false, false);
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
