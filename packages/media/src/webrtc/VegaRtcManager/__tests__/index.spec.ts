import VegaRtcManager from "../";
import { LOWEST_SVC_LAYER_MAX_BITRATE, MIDDLE_SVC_LAYER_MAX_BITRATE } from "../utils";
import { getTopSpatialLayer } from "../utils";
import * as StatsMonitor from "../../stats/StatsMonitor";

import * as CONNECTION_STATUS from "../../../model/connectionStatusConstants";
import rtcManagerEvents from "../../rtcManagerEvents";
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
            getMediaOptions: () => mediaConstraints,
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

        const roomOptions = {
            selfId,
            eventClaim: "claim",
            room: {
                name: helpers.randomString("/room-"),
                turnServers: [],
                clients: [],
                isLocked: false,
                isClaimed: false,
                iceServers: { iceServers: [] },
                knockers: [],
                mediaserverConfigTtlSeconds: 0,
                mode: "group" as const,
                organizationId: "",
                spotlights: [],
                session: null,
            },
            emitter,
            serverSocket,
            webrtcProvider,
        };

        it("subscribes to the StatsMonitor rtcstats polling loop regardless of the sfuHighestPreferredLayerTrackingOn feature flag", () => {
            const subscribeStatsSpy = jest.spyOn(StatsMonitor, "subscribeStats");

            const flaggedOffRtcManager = new VegaRtcManager({ ...roomOptions, features: {} });
            expect(subscribeStatsSpy).toHaveBeenCalledTimes(1);
            flaggedOffRtcManager.disconnectAll();

            const flaggedOnRtcManager = new VegaRtcManager({
                ...roomOptions,
                features: { sfuHighestPreferredLayerTrackingOn: true },
            });
            expect(subscribeStatsSpy).toHaveBeenCalledTimes(2);
            flaggedOnRtcManager.disconnectAll();

            subscribeStatsSpy.mockRestore();
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

    describe("initial highest-preferred-layer cap (no consumers yet)", () => {
        class MockProducerWithRtpSender extends MockProducer {
            rtpSender: { getParameters: () => { encodings: any[] }; setParameters: jest.Mock };

            constructor({ kind, encodings }: { kind: string; encodings: any[] }) {
                super({ kind });
                const parameters = { encodings };
                this.rtpSender = {
                    getParameters: () => parameters,
                    setParameters: jest.fn().mockResolvedValue(undefined),
                };
            }
        }

        const produceWebcam = async (mockVideoProducer: MockProducer) => {
            jest.spyOn(mockSendTransport, "produce").mockImplementation(({ track }: { track: MediaStreamTrack }) => {
                if (track.kind === "video") return mockVideoProducer;
                return new MockProducer({ kind: "audio" });
            });

            rtcManager.setupSocketListeners();
            rtcManager.addCameraStream(helpers.createMockedMediaStream());
            await setTimeout(250);
            sfuWebsocketServer.close();
        };

        it("caps a simulcast webcam producer to spatialLayer 1 right after creation, when the flag is on", async () => {
            rtcManager._features.sfuHighestPreferredLayerTrackingOn = true;
            const mockVideoProducer = new MockProducerWithRtpSender({
                kind: "video",
                encodings: [{ active: true }, { active: true }, { active: true }],
            });

            await produceWebcam(mockVideoProducer);

            expect(mockVideoProducer.rtpSender.setParameters).toHaveBeenCalledWith({
                encodings: [{ active: true }, { active: true }, { active: false }],
            });
            expect(rtcManager._webcamProducerHighestPreferredLayer).toBe(1);
        });

        it("caps an SVC webcam producer to spatialLayer 1 right after creation, when the flag is on", async () => {
            rtcManager._features.sfuHighestPreferredLayerTrackingOn = true;
            const mockVideoProducer = new MockProducerWithRtpSender({
                kind: "video",
                encodings: [{ scalabilityMode: "L3T2" }],
            });

            await produceWebcam(mockVideoProducer);

            expect(mockVideoProducer.rtpSender.setParameters).toHaveBeenCalledWith({
                encodings: [
                    { scalabilityMode: "L2T2", scaleResolutionDownBy: 2, maxBitrate: MIDDLE_SVC_LAYER_MAX_BITRATE },
                ],
            });
            expect(rtcManager._webcamProducerHighestPreferredLayer).toBe(1);
        });

        it("does not cap the webcam producer when the sfuHighestPreferredLayerTrackingOn feature flag is off", async () => {
            const mockVideoProducer = new MockProducerWithRtpSender({
                kind: "video",
                encodings: [{ active: true }, { active: true }, { active: true }],
            });

            await produceWebcam(mockVideoProducer);

            expect(mockVideoProducer.rtpSender.setParameters).not.toHaveBeenCalled();
            expect(rtcManager._webcamProducerHighestPreferredLayer).toBeUndefined();
        });

        it("does not throw, or cap anything, when there is no spare layer to track (e.g. a plain single encoding)", async () => {
            rtcManager._features.sfuHighestPreferredLayerTrackingOn = true;
            const mockVideoProducer = new MockProducerWithRtpSender({
                kind: "video",
                encodings: [{}],
            });

            await produceWebcam(mockVideoProducer);

            expect(mockVideoProducer.rtpSender.setParameters).not.toHaveBeenCalled();
            expect(rtcManager._webcamProducerHighestPreferredLayer).toBeUndefined();
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

    describe("replaceTrack", () => {
        it("leaves stopping the track to the consuming app", () => {
            const track = helpers.createMockedMediaStreamTrack({ kind: "video" });

            rtcManager.replaceTrack(null, track);

            expect(track.stop).not.toHaveBeenCalled();
        });

        it("reports a handed over track that ends", () => {
            const track = helpers.createMockedMediaStreamTrack({ kind: "video" });

            rtcManager.replaceTrack(null, track);
            track.dispatchEvent(new Event("ended"));

            expect(emitter.emit).toHaveBeenCalledWith(rtcManagerEvents.CAMERA_STOPPED_WORKING, {});
        });
    });

    describe("_onChangedHighestPreferredLayer", () => {
        let setParameters: jest.Mock;
        let parameters: { encodings: any[] };

        beforeEach(() => {
            rtcManager._features.sfuHighestPreferredLayerTrackingOn = true;
        });

        const createWebcamProducer = (encodings: any[]) => {
            parameters = { encodings };
            setParameters = jest.fn().mockResolvedValue(undefined);
            rtcManager._webcamProducer = {
                id: "webcam-producer-1",
                rtpSender: {
                    getParameters: () => parameters,
                    setParameters,
                },
            };
            rtcManager._webcamProducerOriginalScalabilityMode = encodings[0]?.scalabilityMode;
            rtcManager._webcamProducerHighestPreferredLayer = getTopSpatialLayer(encodings);
        };

        it("ignores demand changes for a different producer", async () => {
            createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

            await rtcManager._onChangedHighestPreferredLayer({ producerId: "other-producer", spatialLayer: 0 });

            expect(setParameters).not.toHaveBeenCalled();
            expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(0);
        });

        it("does nothing when the sfuHighestPreferredLayerTrackingOn feature flag is off", async () => {
            rtcManager._features.sfuHighestPreferredLayerTrackingOn = false;
            createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

            await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 0 });

            expect(setParameters).not.toHaveBeenCalled();
            expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(0);
        });

        it("does not throw when there is no webcam producer (e.g. the camera was turned off just before the message arrived)", async () => {
            rtcManager._webcamProducer = null;

            await expect(
                rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 0 }),
            ).resolves.toBeUndefined();

            expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(0);
        });

        it("serializes overlapping calls so a later message can't race an earlier one's setParameters()", async () => {
            createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

            let resolveSetParameters: (() => void) | undefined;
            setParameters.mockImplementation(
                () =>
                    new Promise<void>((resolve) => {
                        resolveSetParameters = resolve;
                    }),
            );

            const firstCall = rtcManager._onChangedHighestPreferredLayer({
                producerId: "webcam-producer-1",
                spatialLayer: 0,
            });
            const secondCall = rtcManager._onChangedHighestPreferredLayer({
                producerId: "webcam-producer-1",
                spatialLayer: 1,
            });

            const flushPromises = () => new Promise(jest.requireActual("timers").setImmediate);
            await flushPromises();

            expect(rtcManager.analytics.highestPreferredLayerChangeCounts).toEqual({ "2->0": 1 });
            expect(setParameters).toHaveBeenCalledTimes(1);

            resolveSetParameters!();
            await firstCall;
            await flushPromises();

            resolveSetParameters!();
            await secondCall;

            expect(rtcManager.analytics.highestPreferredLayerChangeCounts).toEqual({ "2->0": 1, "0->1": 1 });
            expect(setParameters).toHaveBeenCalledTimes(2);
        });

        describe("highestPreferredLayer analytics", () => {
            it("counts the first message as a transition from the top spatial layer (the SFU's own initial assumption)", async () => {
                createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

                await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 0 });

                expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(1);
                expect(rtcManager.analytics.highestPreferredLayerChangeCounts).toEqual({ "2->0": 1 });
            });

            it("does not count a first message that matches the initial top spatial layer", async () => {
                createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

                await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 2 });

                expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(0);
                expect(rtcManager.analytics.highestPreferredLayerChangeCounts).toEqual({});
            });

            it("counts and histograms a transition once a second, different value arrives", async () => {
                createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

                await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 2 });
                await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 0 });

                expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(1);
                expect(rtcManager.analytics.highestPreferredLayerChangeCounts).toEqual({ "2->0": 1 });
            });

            it("does not count a repeated message carrying the same value", async () => {
                createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

                await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 2 });
                await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 0 });
                await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 0 });

                expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(1);
                expect(rtcManager.analytics.highestPreferredLayerChangeCounts).toEqual({ "2->0": 1 });
            });

            it("aggregates counts across multiple transitions in the session, including repeats", async () => {
                createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

                await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 2 });
                await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 0 });
                await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 2 });
                await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 0 });

                expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(3);
                expect(rtcManager.analytics.highestPreferredLayerChangeCounts).toEqual({ "2->0": 2, "0->2": 1 });
            });
        });

        describe("simulcast (multiple encodings)", () => {
            it("pauses encodings above the demanded layer and keeps the rest active", async () => {
                createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 0,
                });

                expect(parameters.encodings).toEqual([{ active: true }, { active: false }, { active: false }]);
                expect(setParameters).toHaveBeenCalledWith(parameters);
            });

            it("resumes previously paused encodings up to the demanded layer", async () => {
                createWebcamProducer([{ active: true }, { active: false }, { active: false }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 2,
                });

                expect(parameters.encodings).toEqual([{ active: true }, { active: true }, { active: true }]);
                expect(setParameters).toHaveBeenCalledWith(parameters);
            });

            it("clamps an out-of-range demanded layer (above the top) to the highest real encoding, rather than trusting it", async () => {
                createWebcamProducer([{ active: true }, { active: false }, { active: false }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 99,
                });

                expect(parameters.encodings).toEqual([{ active: true }, { active: true }, { active: true }]);
                expect(setParameters).toHaveBeenCalledWith(parameters);
            });

            it("clamps a negative demanded layer to the base layer, rather than deactivating everything", async () => {
                createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: -5,
                });

                expect(parameters.encodings).toEqual([{ active: true }, { active: false }, { active: false }]);
                expect(setParameters).toHaveBeenCalledWith(parameters);
            });

            it("does not call setParameters when nothing changes", async () => {
                createWebcamProducer([{ active: true }, { active: false }, { active: false }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 0,
                });

                expect(setParameters).not.toHaveBeenCalled();
            });
        });

        describe("SVC (single encoding with scalabilityMode)", () => {
            it("shrinks the scalabilityMode's spatial layer count, scales the resolution down to match, and caps maxBitrate for the middle layer", async () => {
                createWebcamProducer([{ scalabilityMode: "L3T2" }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 1,
                });

                expect(parameters.encodings).toEqual([
                    { scalabilityMode: "L2T2", scaleResolutionDownBy: 2, maxBitrate: MIDDLE_SVC_LAYER_MAX_BITRATE },
                ]);
                expect(setParameters).toHaveBeenCalledWith(parameters);
            });

            it("scales down by 4 and caps maxBitrate when only the lowest of 3 layers is preferred", async () => {
                createWebcamProducer([{ scalabilityMode: "L3T2" }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 0,
                });

                expect(parameters.encodings).toEqual([
                    { scalabilityMode: "L1T2", scaleResolutionDownBy: 4, maxBitrate: LOWEST_SVC_LAYER_MAX_BITRATE },
                ]);
                expect(setParameters).toHaveBeenCalledWith(parameters);
            });

            it("keeps computing the reduction relative to the original scalabilityMode across repeated changes", async () => {
                createWebcamProducer([{ scalabilityMode: "L3T2" }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 1,
                });
                expect(parameters.encodings).toEqual([
                    { scalabilityMode: "L2T2", scaleResolutionDownBy: 2, maxBitrate: MIDDLE_SVC_LAYER_MAX_BITRATE },
                ]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 0,
                });
                expect(parameters.encodings).toEqual([
                    { scalabilityMode: "L1T2", scaleResolutionDownBy: 4, maxBitrate: LOWEST_SVC_LAYER_MAX_BITRATE },
                ]);
            });

            it("changes the maxBitrate cap as a different layer is preferred, removing it once the top layer is preferred", async () => {
                createWebcamProducer([{ scalabilityMode: "L3T2", maxBitrate: 1_000_000 }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 0,
                });
                expect(parameters.encodings).toEqual([
                    { scalabilityMode: "L1T2", scaleResolutionDownBy: 4, maxBitrate: LOWEST_SVC_LAYER_MAX_BITRATE },
                ]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 1,
                });
                expect(parameters.encodings).toEqual([
                    { scalabilityMode: "L2T2", scaleResolutionDownBy: 2, maxBitrate: MIDDLE_SVC_LAYER_MAX_BITRATE },
                ]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 2,
                });
                expect(parameters.encodings).toEqual([{ scalabilityMode: "L3T2", scaleResolutionDownBy: 1 }]);
                expect(parameters.encodings[0]).not.toHaveProperty("maxBitrate");
            });

            it("does not call setParameters when neither the scalabilityMode, resolution scale, nor maxBitrate changes", async () => {
                createWebcamProducer([{ scalabilityMode: "L3T2" }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 2,
                });

                expect(setParameters).not.toHaveBeenCalled();
            });

            it("does not call setParameters for a plain (non-SVC) single encoding", async () => {
                createWebcamProducer([{}]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 0,
                });

                expect(setParameters).not.toHaveBeenCalled();
            });
        });
    });

    describe("updateStreamResolution", () => {
        const createConsumer = ({ spatialLayer = 2, temporalLayer = 1, scalabilityMode = "T2" } = {}) => ({
            appData: { spatialLayer, temporalLayer },
            _appData: { source: "webcam" },
            _closed: false,
            _paused: false,
            _rtpParameters: { encodings: [{ scalabilityMode }] },
        });

        const registerConsumer = (streamId: string, consumerId: string, consumer: any) => {
            rtcManager._streamIdToVideoConsumerId.set(streamId, consumerId);
            rtcManager._consumers.set(consumerId, consumer);
        };

        it("increments numPreferredSpatialLayerChanges and the transition histogram when the spatial layer changes", () => {
            const consumer = createConsumer({ spatialLayer: 2, temporalLayer: 1 });
            registerConsumer("stream1", "consumer1", consumer);

            rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });

            expect(consumer.appData.spatialLayer).toBe(0);
            expect(consumer.appData.temporalLayer).toBe(1);
            expect(rtcManager.analytics.numPreferredSpatialLayerChanges).toBe(1);
            expect(rtcManager.analytics.preferredSpatialLayerChangeCounts).toEqual({ "2->0": 1 });
        });

        it("does not increment numPreferredSpatialLayerChanges when only the temporal layer changes (spatial layer unchanged)", () => {
            const consumer = createConsumer({ spatialLayer: 0, temporalLayer: 1 });
            registerConsumer("stream1", "consumer1", consumer);

            for (let i = 0; i < 9; i++) {
                rtcManager._consumers.set(`filler${i}`, {
                    _appData: { source: "webcam" },
                    _closed: false,
                    _paused: false,
                });
            }

            rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });

            expect(consumer.appData.spatialLayer).toBe(0);
            expect(consumer.appData.temporalLayer).toBe(0);
            expect(rtcManager.analytics.numPreferredSpatialLayerChanges).toBe(0);
            expect(rtcManager.analytics.preferredSpatialLayerChangeCounts).toEqual({});
        });

        it("does not increment numPreferredSpatialLayerChanges, or send a message, when nothing changes", () => {
            const consumer = createConsumer({ spatialLayer: 2, temporalLayer: 1 });
            registerConsumer("stream1", "consumer1", consumer);
            const message = jest.fn();
            rtcManager._vegaConnection = { message } as any;

            rtcManager.updateStreamResolution("stream1", null, { width: 1000, height: 1000 });

            expect(rtcManager.analytics.numPreferredSpatialLayerChanges).toBe(0);
            expect(message).not.toHaveBeenCalled();
        });

        it("aggregates counts across multiple transitions in the session, including repeats", () => {
            const consumer = createConsumer({ spatialLayer: 2, temporalLayer: 1 });
            registerConsumer("stream1", "consumer1", consumer);

            rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });
            rtcManager.updateStreamResolution("stream1", null, { width: 1000, height: 1000 });
            rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });

            expect(rtcManager.analytics.numPreferredSpatialLayerChanges).toBe(3);
            expect(rtcManager.analytics.preferredSpatialLayerChangeCounts).toEqual({ "2->0": 2, "0->2": 1 });
        });

        describe("preferred layer switch latency", () => {
            const createConsumerWithFrameSizes = (
                frameSizes: ({ width: number; height: number } | undefined)[],
                { spatialLayer = 2, temporalLayer = 1, scalabilityMode = "T2" } = {},
            ) => {
                let callIndex = 0;
                return {
                    appData: { spatialLayer, temporalLayer },
                    _appData: { source: "webcam" },
                    _closed: false,
                    _paused: false,
                    closed: false,
                    _rtpParameters: { encodings: [{ scalabilityMode }] },
                    getStats: jest.fn(async () => {
                        const frameSize = frameSizes[Math.min(callIndex, frameSizes.length - 1)];
                        callIndex++;
                        if (!frameSize) return [];
                        return [{ type: "inbound-rtp", frameWidth: frameSize.width, frameHeight: frameSize.height }];
                    }),
                };
            };

            beforeEach(() => {
                jest.useFakeTimers();
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            it("records a latency sample once the consumer's actual frame size changes", async () => {
                const consumer = createConsumerWithFrameSizes([
                    { width: 960, height: 540 },
                    { width: 960, height: 540 },
                    { width: 480, height: 270 },
                ]);
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });

                await jest.advanceTimersByTimeAsync(0);
                await jest.advanceTimersByTimeAsync(500);
                await jest.advanceTimersByTimeAsync(500);

                expect(rtcManager.analytics.numPreferredLayerSwitchLatencySamples).toBe(1);
                expect(rtcManager.analytics.avgPreferredLayerSwitchLatencyMs).toBe(1000);
                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(0);
            });

            it("does not start a watch when only the temporal layer changes (spatial layer unchanged)", () => {
                const consumer = createConsumerWithFrameSizes([{ width: 960, height: 540 }], {
                    spatialLayer: 0,
                    temporalLayer: 1,
                });
                registerConsumer("stream1", "consumer1", consumer);

                for (let i = 0; i < 9; i++) {
                    rtcManager._consumers.set(`filler${i}`, {
                        _appData: { source: "webcam" },
                        _closed: false,
                        _paused: false,
                    });
                }

                rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });

                expect(consumer.appData.spatialLayer).toBe(0);
                expect(consumer.appData.temporalLayer).toBe(0);
                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(0);
                expect(consumer.getStats).not.toHaveBeenCalled();
            });

            it("does not record anything if the frame size never changes before the watch times out", async () => {
                const consumer = createConsumerWithFrameSizes([{ width: 960, height: 540 }]);
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });

                await jest.advanceTimersByTimeAsync(10_000);

                expect(rtcManager.analytics.numPreferredLayerSwitchLatencySamples).toBe(0);
                expect(rtcManager.analytics.avgPreferredLayerSwitchLatencyMs).toBeUndefined();
                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(0);
            });

            it("cancels a stale watch when a newer resize happens for the same consumer", async () => {
                const consumer = createConsumerWithFrameSizes([
                    { width: 960, height: 540 },
                    { width: 480, height: 270 },
                    { width: 480, height: 270 },
                    { width: 720, height: 405 },
                ]);
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });
                await jest.advanceTimersByTimeAsync(0);

                await jest.advanceTimersByTimeAsync(100);
                rtcManager.updateStreamResolution("stream1", null, { width: 1000, height: 1000 });
                await jest.advanceTimersByTimeAsync(0);

                await jest.advanceTimersByTimeAsync(500);
                await jest.advanceTimersByTimeAsync(500);

                expect(consumer.getStats).toHaveBeenCalledTimes(4);
                expect(rtcManager.analytics.numPreferredLayerSwitchLatencySamples).toBe(1);
                expect(rtcManager.analytics.avgPreferredLayerSwitchLatencyMs).toBe(1000);
            });

            it("stops watching once the consumer closes", async () => {
                const consumer = createConsumerWithFrameSizes([{ width: 960, height: 540 }]);
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });
                await jest.advanceTimersByTimeAsync(0);

                consumer.closed = true;

                await jest.advanceTimersByTimeAsync(500);

                expect(consumer.getStats).toHaveBeenCalledTimes(1);
                expect(rtcManager.analytics.numPreferredLayerSwitchLatencySamples).toBe(0);
                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(0);
            });

            it("does not record anything, or throw, when there's no inbound-rtp report to baseline against", async () => {
                const consumer = createConsumerWithFrameSizes([]);
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });

                await jest.advanceTimersByTimeAsync(10_000);

                expect(rtcManager.analytics.numPreferredLayerSwitchLatencySamples).toBe(0);
                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(0);
            });

            it("aggregates avg across multiple recorded samples", () => {
                Array.from({ length: 20 }, (_, i) => (i + 1) * 50).forEach((latencyMs) => {
                    rtcManager._recordPreferredLayerSwitchLatency(latencyMs);
                });

                expect(rtcManager.analytics.numPreferredLayerSwitchLatencySamples).toBe(20);
                expect(rtcManager.analytics.avgPreferredLayerSwitchLatencyMs).toBe(525);
            });
        });
    });

    describe("_onUpdatedStats", () => {
        const webcamTrackId = "webcam-track";

        const makeStatsByView = (
            ssrcMetrics: any,
            { clientId = "client1", trackId = webcamTrackId, ssrc = "1" } = {},
        ) => ({
            [clientId]: { tracks: { [trackId]: { ssrcs: { [ssrc]: ssrcMetrics } } } },
        });

        beforeEach(() => {
            // bytes/packet-loss/jitter are only tracked for our own webcam upload (producer) - mic,
            // screenshare, and every remote peer's inbound video are excluded
            rtcManager._webcamProducer = { track: { id: webcamTrackId } };
        });

        it("accumulates webcamPacketsLostOutbound from an outbound ssrc's remotePacketsLost", () => {
            rtcManager._onUpdatedStats(makeStatsByView({ direction: "out", remotePacketsLost: 3 }));
            rtcManager._onUpdatedStats(makeStatsByView({ direction: "out", remotePacketsLost: 7 }));

            expect(rtcManager.analytics.webcamPacketsLostOutbound).toBe(7);
        });

        it("records jitter samples (converted to ms) and aggregates them", () => {
            rtcManager._onUpdatedStats(makeStatsByView({ direction: "out", jitter: 0.01 }));
            rtcManager._onUpdatedStats(makeStatsByView({ direction: "out", jitter: 0.03 }));

            expect(rtcManager.analytics.numOutboundJitterSamples).toBe(2);
            expect(rtcManager.analytics.avgOutboundJitterMs).toBe(20);
        });

        it("does not record a jitter sample when no jitter value is present on the report", () => {
            rtcManager._onUpdatedStats(makeStatsByView({ direction: "out" }));

            expect(rtcManager.analytics.numOutboundJitterSamples).toBe(0);
        });

        it("does not decrease totals if a cumulative counter appears to reset", () => {
            rtcManager._onUpdatedStats(makeStatsByView({ direction: "out", remotePacketsLost: 5000 }));
            rtcManager._onUpdatedStats(makeStatsByView({ direction: "out", remotePacketsLost: 100 }));

            expect(rtcManager.analytics.webcamPacketsLostOutbound).toBe(5000);
        });

        it("prunes a ssrc's last-seen counters once it stops appearing in stats, without losing its already-counted total", () => {
            rtcManager._onUpdatedStats(makeStatsByView({ direction: "out", remotePacketsLost: 1000 }));
            expect(rtcManager._lastSeenSsrcCounters.size).toBe(1);

            rtcManager._onUpdatedStats({});

            expect(rtcManager._lastSeenSsrcCounters.size).toBe(0);
            expect(rtcManager.analytics.webcamPacketsLostOutbound).toBe(1000);
        });

        it("sums across multiple outbound ssrcs/clients reported in the same tick", () => {
            rtcManager._onUpdatedStats({
                client1: {
                    tracks: {
                        [webcamTrackId]: { ssrcs: { "1": { direction: "out", remotePacketsLost: 1000 } } },
                    },
                },
                client2: {
                    tracks: {
                        [webcamTrackId]: { ssrcs: { "2": { direction: "out", remotePacketsLost: 2000 } } },
                    },
                },
            });

            expect(rtcManager.analytics.webcamPacketsLostOutbound).toBe(3000);
        });
    });
});
