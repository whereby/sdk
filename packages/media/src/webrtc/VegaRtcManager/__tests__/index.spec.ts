import VegaRtcManager from "../";
import { getInitialHighestPreferredLayer } from "../utils";
import {
    INITIAL_HIGHEST_PREFERRED_LAYER,
    LOWEST_SVC_LAYER_MAX_BITRATE,
    MIDDLE_SVC_LAYER_MAX_BITRATE,
} from "../../constants";
import * as StatsMonitor from "../../stats/StatsMonitor";
import * as peerConnectionTracker from "../../stats/StatsMonitor/peerConnectionTracker";

import * as CONNECTION_STATUS from "../../../model/connectionStatusConstants";
import rtcManagerEvents from "../../rtcManagerEvents";
import * as helpers from "../../../../tests/webrtc/webRtcHelpers";
import { MockTransport, MockProducer } from "../../../../tests/webrtc/webRtcHelpers";
import WS from "jest-websocket-mock";
import { setTimeout } from "timers/promises";
import { GetConstraintsOptions, WebRTCProvider } from "../../types";

// mimics mediasoup's Producer.setMaxSpatialLayer() / setRtpEncodingParameters() applying to the rtpSender's encodings
const addMediasoupEncoderControls = (producer: any, parameters: { encodings: any[] }) =>
    Object.assign(producer, {
        maxSpatialLayer: undefined as number | undefined,
        setMaxSpatialLayer: jest.fn(async (spatialLayer: number) => {
            parameters.encodings.forEach((encoding, index) => (encoding.active = index <= spatialLayer));
            producer.maxSpatialLayer = spatialLayer;
        }),
        setRtpEncodingParameters: jest.fn(async (params: any) => {
            parameters.encodings = parameters.encodings.map((encoding) => ({ ...encoding, ...params }));
        }),
    });

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

    describe("webcam stats subscription", () => {
        let stopStats: jest.Mock;
        let subscribeStatsSpy: jest.SpyInstance;

        beforeEach(() => {
            stopStats = jest.fn();
            subscribeStatsSpy = jest.spyOn(StatsMonitor, "subscribeStats").mockReturnValue({ stop: stopStats });
        });

        afterEach(() => {
            subscribeStatsSpy.mockRestore();
        });

        const produceWebcam = async () => {
            const mockVideoProducer = Object.assign(new MockProducer({ kind: "video" }), { appData: {} });
            jest.spyOn(mockSendTransport, "produce").mockImplementation(({ track }: { track: MediaStreamTrack }) => {
                if (track.kind === "video") return mockVideoProducer;
                return new MockProducer({ kind: "audio" });
            });

            rtcManager.setupSocketListeners();
            rtcManager.addCameraStream(helpers.createMockedMediaStream());
            await setTimeout(250);
            sfuWebsocketServer.close();

            return mockVideoProducer;
        };

        const getCloseListener = (producer: MockProducer) =>
            producer.observer.once.mock.calls.find(([event]: [string]) => event === "close")[1];

        it("does not collect stats before there is a webcam producer", () => {
            expect(rtcManager._statsSubscription).toBeNull();
            expect(subscribeStatsSpy).not.toHaveBeenCalled();
        });

        it("collects stats while the webcam producer exists, and stops once it closes", async () => {
            const producer = await produceWebcam();
            jest.spyOn(rtcManager._qualityMonitor, "removeProducer").mockImplementation(() => {});

            expect(subscribeStatsSpy).toHaveBeenCalledTimes(1);

            getCloseListener(producer)();

            expect(stopStats).toHaveBeenCalledTimes(1);
            expect(rtcManager._statsSubscription).toBeNull();
        });

        it("stops collecting stats on disconnectAll", async () => {
            await produceWebcam();
            // the socket stubs don't hand back deregister functions
            rtcManager._socketListenerDeregisterFunctions = [];

            rtcManager.disconnectAll();

            expect(stopStats).toHaveBeenCalledTimes(1);
            expect(rtcManager._statsSubscription).toBeNull();
        });
    });

    describe("initial highest-preferred-layer cap (no consumers yet)", () => {
        class MockProducerWithRtpSender extends MockProducer {
            rtpSender: { getParameters: () => { encodings: any[] } };
            setMaxSpatialLayer!: jest.Mock;
            setRtpEncodingParameters!: jest.Mock;

            constructor({ kind, encodings }: { kind: string; encodings: any[] }) {
                super({ kind });
                const parameters = { encodings };
                this.rtpSender = { getParameters: () => parameters };
                addMediasoupEncoderControls(this, parameters);
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

        it("caps a simulcast webcam producer to the initial highest preferred layer right after creation, when the flag is on", async () => {
            rtcManager._features.sfuHighestPreferredLayerTrackingOn = true;
            const mockVideoProducer = new MockProducerWithRtpSender({
                kind: "video",
                encodings: [{ active: true }, { active: true }, { active: true }],
            });

            await produceWebcam(mockVideoProducer);

            expect(mockVideoProducer.rtpSender.getParameters().encodings).toEqual(
                [0, 1, 2].map((layer) => ({ active: layer <= INITIAL_HIGHEST_PREFERRED_LAYER })),
            );
            expect(rtcManager._webcamProducerHighestPreferredLayer).toBe(INITIAL_HIGHEST_PREFERRED_LAYER);
        });

        it("doesn't keep a simulcast producer's per-encoding scalabilityMode or maxBitrate as SVC ones", async () => {
            rtcManager._features.sfuHighestPreferredLayerTrackingOn = true;
            const mockVideoProducer = new MockProducerWithRtpSender({
                kind: "video",
                encodings: [0, 1, 2].map(() => ({ active: true, scalabilityMode: "L1T3", maxBitrate: 500_000 })),
            });

            await produceWebcam(mockVideoProducer);

            expect(rtcManager._webcamProducerOriginalSvcScalabilityMode).toBeUndefined();
            expect(rtcManager._webcamProducerOriginalSvcMaxBitrate).toBeUndefined();
        });

        it("caps an SVC webcam producer to the initial highest preferred layer right after creation, when the flag is on", async () => {
            rtcManager._features.sfuHighestPreferredLayerTrackingOn = true;
            const mockVideoProducer = new MockProducerWithRtpSender({
                kind: "video",
                encodings: [{ scalabilityMode: "L3T2" }],
            });

            await produceWebcam(mockVideoProducer);

            const expectedEncodingByLayer = [
                { scalabilityMode: "L1T2", scaleResolutionDownBy: 4, maxBitrate: LOWEST_SVC_LAYER_MAX_BITRATE },
                { scalabilityMode: "L2T2", scaleResolutionDownBy: 2, maxBitrate: MIDDLE_SVC_LAYER_MAX_BITRATE },
                { scalabilityMode: "L3T2" },
            ];
            expect(mockVideoProducer.rtpSender.getParameters().encodings).toEqual([
                expectedEncodingByLayer[INITIAL_HIGHEST_PREFERRED_LAYER],
            ]);
            expect(rtcManager._webcamProducerHighestPreferredLayer).toBe(INITIAL_HIGHEST_PREFERRED_LAYER);
        });

        it("keeps the SVC producer's own maxBitrate as the cap, never raising it", async () => {
            rtcManager._features.sfuHighestPreferredLayerTrackingOn = true;
            // e.g. low-data mode: two spatial layers, capped at 300 kbps
            const mockVideoProducer = new MockProducerWithRtpSender({
                kind: "video",
                encodings: [{ scalabilityMode: "L2T2", maxBitrate: 300_000 }],
            });

            await produceWebcam(mockVideoProducer);

            expect(mockVideoProducer.rtpSender.getParameters().encodings[0].maxBitrate).toBeLessThanOrEqual(300_000);
        });

        it("finishes setting up the webcam producer without waiting for the initial cap's encoder update", async () => {
            rtcManager._features.sfuHighestPreferredLayerTrackingOn = true;
            const mockVideoProducer = new MockProducerWithRtpSender({
                kind: "video",
                encodings: [{ active: true }, { active: true }, { active: true }],
            });
            mockVideoProducer.setMaxSpatialLayer.mockReturnValue(new Promise(() => {}));

            await produceWebcam(mockVideoProducer);

            // the close listener must be in place even while the encoder update is pending, or a producer
            // closed in the meantime would be left behind as rtcManager._webcamProducer
            expect(mockVideoProducer.observer.once).toHaveBeenCalledWith("close", expect.any(Function));
        });

        it("does not cap the webcam producer when the sfuHighestPreferredLayerTrackingOn feature flag is off", async () => {
            const mockVideoProducer = new MockProducerWithRtpSender({
                kind: "video",
                encodings: [{ active: true }, { active: true }, { active: true }],
            });

            await produceWebcam(mockVideoProducer);

            expect(mockVideoProducer.setMaxSpatialLayer).not.toHaveBeenCalled();
            expect(rtcManager._webcamProducerHighestPreferredLayer).toBeUndefined();
        });

        it("does not update the encoder for a plain (non-SVC) single encoding, since there's no scalabilityMode to reduce", async () => {
            rtcManager._features.sfuHighestPreferredLayerTrackingOn = true;
            const mockVideoProducer = new MockProducerWithRtpSender({
                kind: "video",
                encodings: [{}],
            });

            await produceWebcam(mockVideoProducer);

            expect(mockVideoProducer.setMaxSpatialLayer).not.toHaveBeenCalled();
            expect(mockVideoProducer.setRtpEncodingParameters).not.toHaveBeenCalled();
            // a plain encoding has a single spatial layer
            expect(rtcManager._webcamProducerHighestPreferredLayer).toBe(0);
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

    describe("setAudioOnly", () => {
        let vegaConnection: any;

        beforeEach(() => {
            vegaConnection = { message: jest.fn() };
            rtcManager._vegaConnection = vegaConnection;
        });

        it("sends enableAudioOnly to the SFU when enabling", () => {
            rtcManager.setAudioOnly(true);

            expect(vegaConnection.message).toHaveBeenCalledWith("enableAudioOnly");
            expect(rtcManager._isAudioOnlyMode).toBe(true);
        });

        it("sends disableAudioOnly to the SFU when disabling", () => {
            rtcManager.setAudioOnly(true);
            rtcManager.setAudioOnly(false);

            expect(vegaConnection.message).toHaveBeenLastCalledWith("disableAudioOnly");
            expect(rtcManager._isAudioOnlyMode).toBe(false);
        });

        it("remembers the mode when there is no SFU connection", () => {
            rtcManager._vegaConnection = null;

            rtcManager.setAudioOnly(true);

            expect(rtcManager._isAudioOnlyMode).toBe(true);
        });
    });

    describe("_join", () => {
        let vegaConnection: any;

        beforeEach(() => {
            vegaConnection = {
                message: jest.fn(),
                request: jest.fn().mockResolvedValue({ routerRtpCapabilities: {} }),
            };
            rtcManager._vegaConnection = vegaConnection;
            jest.spyOn(rtcManager, "_createTransport").mockResolvedValue(undefined);
        });

        it("re-applies audio-only mode when it is enabled", async () => {
            rtcManager._isAudioOnlyMode = true;

            await rtcManager._join();

            expect(vegaConnection.message).toHaveBeenCalledWith("enableAudioOnly");
        });

        it("does not send audio-only mode when it is disabled", async () => {
            await rtcManager._join();

            expect(vegaConnection.message).not.toHaveBeenCalledWith("enableAudioOnly");
            expect(vegaConnection.message).not.toHaveBeenCalledWith("disableAudioOnly");
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
        let setMaxSpatialLayer: jest.Mock;
        let setRtpEncodingParameters: jest.Mock;
        let parameters: { encodings: any[] };

        beforeEach(() => {
            rtcManager._features.sfuHighestPreferredLayerTrackingOn = true;
        });

        const createWebcamProducer = (encodings: any[]) => {
            parameters = { encodings };
            rtcManager._webcamProducer = addMediasoupEncoderControls(
                {
                    id: "webcam-producer-1",
                    rtpParameters: { encodings },
                    rtpSender: { getParameters: () => parameters },
                },
                parameters,
            );
            ({ setMaxSpatialLayer, setRtpEncodingParameters } = rtcManager._webcamProducer);
            const svcEncoding = encodings.length === 1 ? encodings[0] : undefined;
            rtcManager._webcamProducerOriginalSvcScalabilityMode = svcEncoding?.scalabilityMode;
            rtcManager._webcamProducerOriginalSvcMaxBitrate = svcEncoding?.maxBitrate;
            rtcManager._webcamProducerHighestPreferredLayer = getInitialHighestPreferredLayer(encodings);
        };

        const expectNoEncoderUpdate = () => {
            expect(setMaxSpatialLayer).not.toHaveBeenCalled();
            expect(setRtpEncodingParameters).not.toHaveBeenCalled();
        };

        // derived rather than hardcoded so the tests keep working if INITIAL_HIGHEST_PREFERRED_LAYER changes
        const initialLayer = getInitialHighestPreferredLayer([{}, {}, {}]);
        const otherLayer = initialLayer === 0 ? 1 : 0;

        it("ignores highest preferred layer changes for a different producer", async () => {
            createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

            await rtcManager._onChangedHighestPreferredLayer({ producerId: "other-producer", spatialLayer: 0 });

            expectNoEncoderUpdate();
            expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(0);
        });

        it("does nothing when the sfuHighestPreferredLayerTrackingOn feature flag is off", async () => {
            rtcManager._features.sfuHighestPreferredLayerTrackingOn = false;
            createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

            await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 0 });

            expectNoEncoderUpdate();
            expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(0);
        });

        it.each([NaN, undefined, "1", Infinity])(
            "ignores a message with an invalid spatialLayer (%p)",
            async (spatialLayer) => {
                createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: spatialLayer as any,
                });

                expectNoEncoderUpdate();
                expect(parameters.encodings).toEqual([{ active: true }, { active: true }, { active: true }]);
                expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(0);
            },
        );

        it("does not throw when there is no webcam producer (e.g. the camera was turned off just before the message arrived)", async () => {
            rtcManager._webcamProducer = null;

            await expect(
                rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 0 }),
            ).resolves.toBeUndefined();

            expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(0);
        });

        it("serializes overlapping calls so a later message can't race an earlier one's encoder update", async () => {
            createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

            let finishSetMaxSpatialLayer: (() => void) | undefined;
            setMaxSpatialLayer.mockImplementationOnce(
                () =>
                    new Promise<void>((resolve) => {
                        finishSetMaxSpatialLayer = resolve;
                    }),
            );

            const firstCall = rtcManager._onChangedHighestPreferredLayer({
                producerId: "webcam-producer-1",
                spatialLayer: otherLayer,
            });
            const secondCall = rtcManager._onChangedHighestPreferredLayer({
                producerId: "webcam-producer-1",
                spatialLayer: initialLayer,
            });

            expect(rtcManager.analytics.highestPreferredLayerChangeCounts).toEqual({
                [`${initialLayer}->${otherLayer}`]: 1,
                [`${otherLayer}->${initialLayer}`]: 1,
            });
            expect(setMaxSpatialLayer).toHaveBeenCalledTimes(1);

            finishSetMaxSpatialLayer!();
            await Promise.all([firstCall, secondCall]);

            expect(setMaxSpatialLayer).toHaveBeenCalledTimes(2);
            expect(setMaxSpatialLayer).toHaveBeenLastCalledWith(initialLayer);
        });

        it("still applies a newer layer when an earlier encoder update fails", async () => {
            createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

            let failSetMaxSpatialLayer: ((error: Error) => void) | undefined;
            setMaxSpatialLayer.mockImplementationOnce(
                () =>
                    new Promise<void>((_resolve, reject) => {
                        failSetMaxSpatialLayer = reject;
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

            failSetMaxSpatialLayer!(new Error("InvalidModificationError"));

            await expect(Promise.all([firstCall, secondCall])).resolves.toBeDefined();
            expect(setMaxSpatialLayer).toHaveBeenCalledTimes(2);
            expect(setMaxSpatialLayer).toHaveBeenLastCalledWith(1);
        });

        describe("highestPreferredLayer analytics", () => {
            const sendHighestPreferredLayer = (spatialLayer: number) =>
                rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer });

            beforeEach(() => {
                createWebcamProducer([{ active: true }, { active: true }, { active: true }]);
            });

            it("counts the first message as a transition from the initial highest preferred layer the webcam was capped to", async () => {
                await sendHighestPreferredLayer(otherLayer);

                expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(1);
                expect(rtcManager.analytics.highestPreferredLayerChangeCounts).toEqual({
                    [`${initialLayer}->${otherLayer}`]: 1,
                });
            });

            it("does not count a first message that matches the initial highest preferred layer", async () => {
                await sendHighestPreferredLayer(initialLayer);

                expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(0);
                expect(rtcManager.analytics.highestPreferredLayerChangeCounts).toEqual({});
            });

            it("counts and histograms a transition once a second, different value arrives", async () => {
                await sendHighestPreferredLayer(initialLayer);
                await sendHighestPreferredLayer(otherLayer);

                expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(1);
                expect(rtcManager.analytics.highestPreferredLayerChangeCounts).toEqual({
                    [`${initialLayer}->${otherLayer}`]: 1,
                });
            });

            it("does not count a repeated message carrying the same value", async () => {
                await sendHighestPreferredLayer(initialLayer);
                await sendHighestPreferredLayer(otherLayer);
                await sendHighestPreferredLayer(otherLayer);

                expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(1);
                expect(rtcManager.analytics.highestPreferredLayerChangeCounts).toEqual({
                    [`${initialLayer}->${otherLayer}`]: 1,
                });
            });

            it("aggregates counts across multiple transitions in the session, including repeats", async () => {
                await sendHighestPreferredLayer(initialLayer);
                await sendHighestPreferredLayer(otherLayer);
                await sendHighestPreferredLayer(initialLayer);
                await sendHighestPreferredLayer(otherLayer);

                expect(rtcManager.analytics.numHighestPreferredLayerChanges).toBe(3);
                expect(rtcManager.analytics.highestPreferredLayerChangeCounts).toEqual({
                    [`${initialLayer}->${otherLayer}`]: 2,
                    [`${otherLayer}->${initialLayer}`]: 1,
                });
            });
        });

        describe("simulcast (multiple encodings)", () => {
            it("pauses encodings above the highest preferred layer and keeps the rest active", async () => {
                createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 0,
                });

                expect(parameters.encodings).toEqual([{ active: true }, { active: false }, { active: false }]);
                expect(setMaxSpatialLayer).toHaveBeenCalledWith(0);
            });

            it("resumes previously paused encodings up to the highest preferred layer", async () => {
                createWebcamProducer([{ active: true }, { active: false }, { active: false }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 2,
                });

                expect(parameters.encodings).toEqual([{ active: true }, { active: true }, { active: true }]);
                expect(setMaxSpatialLayer).toHaveBeenCalledWith(2);
            });

            it("clamps an out-of-range highest preferred layer (above the top) to the highest real encoding, rather than trusting it", async () => {
                createWebcamProducer([{ active: true }, { active: false }, { active: false }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 99,
                });

                expect(parameters.encodings).toEqual([{ active: true }, { active: true }, { active: true }]);
                expect(setMaxSpatialLayer).toHaveBeenCalledWith(2);
            });

            it("clamps a negative highest preferred layer to the base layer, rather than deactivating everything", async () => {
                createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: -5,
                });

                expect(parameters.encodings).toEqual([{ active: true }, { active: false }, { active: false }]);
                expect(setMaxSpatialLayer).toHaveBeenCalledWith(0);
            });

            it("does not update the encoder again when the layer is unchanged", async () => {
                createWebcamProducer([{ active: true }, { active: true }, { active: true }]);

                await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 0 });
                await rtcManager._onChangedHighestPreferredLayer({ producerId: "webcam-producer-1", spatialLayer: 0 });

                expect(setMaxSpatialLayer).toHaveBeenCalledTimes(1);
            });

            describe("CPU overuse", () => {
                it("caps the SFU's highest preferred layer at layer 1 while CPU overuse is detected", async () => {
                    createWebcamProducer([{ active: true }, { active: true }, { active: true }]);
                    rtcManager._cpuOveruseDetected = true;

                    await rtcManager._onChangedHighestPreferredLayer({
                        producerId: "webcam-producer-1",
                        spatialLayer: 2,
                    });

                    expect(setMaxSpatialLayer).toHaveBeenLastCalledWith(1);
                    expect(parameters.encodings).toEqual([{ active: true }, { active: true }, { active: false }]);
                });

                it("doesn't re-activate layers the SFU asked to cap when CPU overuse is detected", async () => {
                    createWebcamProducer([{ active: true }, { active: true }, { active: true }]);
                    await rtcManager._onChangedHighestPreferredLayer({
                        producerId: "webcam-producer-1",
                        spatialLayer: 0,
                    });

                    rtcManager._cpuOveruseDetected = true;
                    rtcManager._syncResourceUsage();
                    await rtcManager._highestPreferredLayerUpdate;

                    expect(setMaxSpatialLayer).toHaveBeenLastCalledWith(0);
                    expect(parameters.encodings).toEqual([{ active: true }, { active: false }, { active: false }]);
                });

                it("lowers the encoder to layer 1 when CPU overuse is detected while the SFU wants the top layer", async () => {
                    createWebcamProducer([{ active: true }, { active: true }, { active: true }]);
                    await rtcManager._onChangedHighestPreferredLayer({
                        producerId: "webcam-producer-1",
                        spatialLayer: 2,
                    });

                    rtcManager._cpuOveruseDetected = true;
                    rtcManager._syncResourceUsage();
                    await rtcManager._highestPreferredLayerUpdate;

                    expect(setMaxSpatialLayer).toHaveBeenLastCalledWith(1);
                });
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
                expect(setRtpEncodingParameters).toHaveBeenCalledTimes(1);
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
                expect(setRtpEncodingParameters).toHaveBeenCalledTimes(1);
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

            it("changes the maxBitrate cap as a different layer is preferred, restoring the producer's own cap at the top layer", async () => {
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
                expect(parameters.encodings).toEqual([
                    { scalabilityMode: "L3T2", scaleResolutionDownBy: 1, maxBitrate: 1_000_000 },
                ]);
            });

            it("never raises the maxBitrate above the producer's own cap", async () => {
                createWebcamProducer([{ scalabilityMode: "L3T2", maxBitrate: 300_000 }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 1,
                });

                expect(parameters.encodings).toEqual([
                    { scalabilityMode: "L2T2", scaleResolutionDownBy: 2, maxBitrate: 300_000 },
                ]);
            });

            it("does not update the encoder when neither the scalabilityMode, resolution scale, nor maxBitrate changes", async () => {
                createWebcamProducer([{ scalabilityMode: "L3T2" }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 2,
                });

                expectNoEncoderUpdate();
            });

            it("does not cap a single-spatial-layer encoding's bitrate, since there's no layer to drop", async () => {
                createWebcamProducer([{ scalabilityMode: "L1T3", maxBitrate: 1_000_000 }]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 0,
                });

                expectNoEncoderUpdate();
                expect(parameters.encodings).toEqual([{ scalabilityMode: "L1T3", maxBitrate: 1_000_000 }]);
            });

            it("does not update the encoder for a plain (non-SVC) single encoding", async () => {
                createWebcamProducer([{}]);

                await rtcManager._onChangedHighestPreferredLayer({
                    producerId: "webcam-producer-1",
                    spatialLayer: 0,
                });

                expectNoEncoderUpdate();
            });
        });
    });

    describe("SFU reconnect", () => {
        const OriginalMediaStream = (global as any).MediaStream;

        beforeEach(() => {
            // jsdom has no MediaStream
            let count = 0;
            (global as any).MediaStream = class {
                id = `stream-${++count}`;
                tracks: any[] = [];
                addTrack(track: any) {
                    this.tracks.push(track);
                }
                removeTrack(track: any) {
                    this.tracks = this.tracks.filter((t) => t !== track);
                }
                getTracks() {
                    return this.tracks;
                }
            };
        });

        afterEach(() => {
            (global as any).MediaStream = OriginalMediaStream;
        });

        // a receive transport whose close() closes its consumers, as mediasoup's does
        const createReceiveTransport = () => {
            const closeListeners: (() => void)[] = [];
            return {
                consume: jest.fn(async (options: any) => ({
                    id: options.id,
                    kind: "video",
                    track: { id: `track-${options.id}` },
                    appData: options.appData,
                    _appData: { source: "webcam" },
                    _rtpParameters: { encodings: [{ scalabilityMode: "L3T2" }] },
                    pause: jest.fn(),
                    resume: jest.fn(),
                    observer: { once: (event: string, listener: () => void) => closeListeners.push(listener) },
                })),
                close: () => closeListeners.forEach((listener) => listener()),
            };
        };

        const consumerOptions = (id: string, clientId = "remote-client") =>
            ({
                id,
                producerId: `${clientId}-webcam-producer`,
                kind: "video",
                rtpParameters: {},
                appData: { sourceClientId: clientId, streamId: `${clientId}-webcam`, screenShare: false },
            }) as any;

        it("re-applies a stream's last requested resolution to its consumer created after reconnecting", async () => {
            const message = jest.fn();
            rtcManager._vegaConnection = { message } as any;
            rtcManager._receiveTransport = createReceiveTransport() as any;

            await rtcManager._onConsumerReady(consumerOptions("consumer-before"));
            const { webcamStream } = rtcManager._getOrCreateClientState("remote-client");
            rtcManager.updateStreamResolution(webcamStream!.id, null, { width: 1280, height: 720 });

            // the connection to the SFU drops, and the layout, so the requested resolution, stays the same
            rtcManager._reconnect = false;
            rtcManager._onClose();
            rtcManager._vegaConnection = { message } as any;
            rtcManager._receiveTransport = createReceiveTransport() as any;
            message.mockClear();

            await rtcManager._onConsumerReady(consumerOptions("consumer-after"));

            expect(rtcManager._getOrCreateClientState("remote-client").webcamStream!.id).toBe(webcamStream!.id);
            expect(message).toHaveBeenCalledWith(
                "setConsumersPreferredLayers",
                expect.objectContaining({ consumerIds: ["consumer-after"] }),
            );
        });

        it("re-applies the other streams' resolutions as more consumers become active", async () => {
            rtcManager._features.uncappedSingleRemoteVideoOn = true;
            const message = jest.fn();
            rtcManager._vegaConnection = { message } as any;
            rtcManager._receiveTransport = createReceiveTransport() as any;

            // a small tile, but the only video: uncapped
            await rtcManager._onConsumerReady(consumerOptions("consumer-a", "client-a"));
            const { webcamStream } = rtcManager._getOrCreateClientState("client-a");
            rtcManager.updateStreamResolution(webcamStream!.id, null, { width: 200, height: 200 });
            expect(message).toHaveBeenLastCalledWith(
                "setConsumersPreferredLayers",
                expect.objectContaining({ consumerIds: ["consumer-a"], spatialLayer: 2 }),
            );

            // a second video (e.g. recreated after a reconnect): the first one's tile is small again
            await rtcManager._onConsumerReady(consumerOptions("consumer-b", "client-b"));

            expect(message).toHaveBeenLastCalledWith(
                "setConsumersPreferredLayers",
                expect.objectContaining({ consumerIds: ["consumer-a"], spatialLayer: 0 }),
            );
        });

        it("forgets the requested resolutions when disconnecting", () => {
            rtcManager.updateStreamResolution("some-stream", null, { width: 1280, height: 720 });

            rtcManager.disconnectAll();

            expect(rtcManager._streamIdToVideoResolution.size).toBe(0);
        });

        it("forgets a client's requested resolutions when it disconnects, keeping the other clients'", async () => {
            rtcManager._vegaConnection = { message: jest.fn() } as any;
            rtcManager._receiveTransport = createReceiveTransport() as any;

            await rtcManager._onConsumerReady(consumerOptions("consumer-a", "client-a"));
            await rtcManager._onConsumerReady(consumerOptions("consumer-b", "client-b"));
            const streamA = rtcManager._getOrCreateClientState("client-a").webcamStream!;
            const streamB = rtcManager._getOrCreateClientState("client-b").webcamStream!;
            rtcManager.updateStreamResolution(streamA.id, null, { width: 1280, height: 720 });
            rtcManager.updateStreamResolution(streamB.id, null, { width: 640, height: 360 });

            rtcManager.disconnect("client-a");

            expect(rtcManager._streamIdToVideoResolution.has(streamA.id)).toBe(false);
            expect(rtcManager._streamIdToVideoResolution.get(streamB.id)).toEqual({ width: 640, height: 360 });
        });

        describe("as the number of active videos changes", () => {
            // consumers that keep track of being paused and closed, as mediasoup's do
            const createTrackingReceiveTransport = () => {
                const consumers: Record<string, any> = {};
                const transport = {
                    closed: false,
                    consume: jest.fn(async (options: any) => {
                        const closeListeners: (() => void)[] = [];
                        const consumer: any = {
                            id: options.id,
                            kind: "video",
                            track: { id: `track-${options.id}` },
                            appData: options.appData,
                            _appData: { source: "webcam" },
                            _rtpParameters: { encodings: [{ scalabilityMode: "L3T2" }] },
                            _paused: false,
                            _closed: false,
                            pause: jest.fn(() => (consumer._paused = true)),
                            resume: jest.fn(() => (consumer._paused = false)),
                            observer: { once: (_event: string, listener: () => void) => closeListeners.push(listener) },
                            close: () => {
                                consumer._closed = true;
                                closeListeners.forEach((listener) => listener());
                            },
                        };
                        consumers[options.id] = consumer;
                        return consumer;
                    }),
                };
                return { transport, consumers };
            };

            let message: jest.Mock;
            let consumers: Record<string, any>;
            let transport: ReturnType<typeof createTrackingReceiveTransport>["transport"];

            const addVideo = async (clientId: string, { accept = true } = {}) => {
                await rtcManager._onConsumerReady(consumerOptions(`consumer-${clientId}`, clientId));
                if (accept) rtcManager.acceptNewStream({ streamId: clientId, clientId });
            };
            const lastLayerOf = (consumerId: string) =>
                message.mock.calls
                    .filter(
                        ([method, data]) =>
                            method === "setConsumersPreferredLayers" && data.consumerIds[0] === consumerId,
                    )
                    .pop()?.[1].spatialLayer;

            beforeEach(async () => {
                rtcManager._features.uncappedSingleRemoteVideoOn = true;
                message = jest.fn();
                rtcManager._vegaConnection = { message } as any;
                ({ transport, consumers } = createTrackingReceiveTransport());
                rtcManager._receiveTransport = transport as any;

                // a small tile, but the only video: uncapped
                await addVideo("client-a");
                const { webcamStream } = rtcManager._getOrCreateClientState("client-a");
                rtcManager.updateStreamResolution(webcamStream!.id, null, { width: 200, height: 200 });
                expect(lastLayerOf("consumer-client-a")).toBe(2);
            });

            it("re-applies the layers when the app accepts another video", async () => {
                await addVideo("client-b", { accept: false });
                // not accepted yet, so still paused and not an active video
                expect(lastLayerOf("consumer-client-a")).toBe(2);

                rtcManager.acceptNewStream({ streamId: "client-b", clientId: "client-b" });

                expect(lastLayerOf("consumer-client-a")).toBe(0);
            });

            it("re-applies the layers when the SFU pauses and resumes another video", async () => {
                await addVideo("client-b");
                expect(lastLayerOf("consumer-client-a")).toBe(0);

                rtcManager._onConsumerPaused({ consumerId: "consumer-client-b" });
                expect(lastLayerOf("consumer-client-a")).toBe(2);

                rtcManager._onConsumerResumed({ consumerId: "consumer-client-b" });
                expect(lastLayerOf("consumer-client-a")).toBe(0);
            });

            it("re-applies the layers when another video closes", async () => {
                await addVideo("client-b");
                expect(lastLayerOf("consumer-client-a")).toBe(0);

                consumers["consumer-client-b"].close();

                expect(lastLayerOf("consumer-client-a")).toBe(2);
            });

            it("doesn't re-apply the layers while the whole receive transport is closing", async () => {
                await addVideo("client-b");
                message.mockClear();

                transport.closed = true;
                consumers["consumer-client-b"].close();

                expect(message).not.toHaveBeenCalled();
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

            // 9 more active videos, 10 in all: over 8, a video at spatial layer 0 drops to a lower temporal
            // layer, so only the temporal layer changes
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

                await jest.advanceTimersByTimeAsync(100);
                await jest.advanceTimersByTimeAsync(100);

                expect(rtcManager._preferredLayerSwitchLatencyStats.count).toBe(1);
                expect(rtcManager.analytics.avgPreferredLayerSwitchLatencyMs).toBe(200);
                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(0);
            });

            it("does not start a watch when only the temporal layer changes (spatial layer unchanged)", () => {
                const consumer = createConsumerWithFrameSizes([{ width: 960, height: 540 }], {
                    spatialLayer: 0,
                    temporalLayer: 1,
                });
                registerConsumer("stream1", "consumer1", consumer);

                // 9 more active videos, 10 in all: over 8, a video at spatial layer 0 drops to a lower temporal
                // layer, so only the temporal layer changes
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

                expect(rtcManager._preferredLayerSwitchLatencyStats.count).toBe(0);
                expect(rtcManager.analytics.avgPreferredLayerSwitchLatencyMs).toBeUndefined();
                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(0);
            });

            it("gives up on time even if the first getStats() never settles", async () => {
                const consumer = createConsumerWithFrameSizes([{ width: 960, height: 540 }]);
                consumer.getStats.mockImplementation(() => new Promise(() => {}));
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });
                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(1);

                await jest.advanceTimersByTimeAsync(10_000);

                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(0);
            });

            it("doesn't start another getStats() while the previous poll is still running", async () => {
                const consumer = createConsumerWithFrameSizes([{ width: 960, height: 540 }]);
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });
                await jest.advanceTimersByTimeAsync(0);
                expect(consumer.getStats).toHaveBeenCalledTimes(1);

                // every poll from now on takes 1.15 s
                consumer.getStats.mockImplementation(
                    () =>
                        new Promise((resolve) =>
                            globalThis.setTimeout(
                                () => resolve([{ type: "inbound-rtp", frameWidth: 960, frameHeight: 540 }]),
                                1150,
                            ),
                        ),
                );
                await jest.advanceTimersByTimeAsync(3000);

                // polls at 0.1, 1.3 and 2.5 s; the other 27 ticks are skipped while one is running
                expect(consumer.getStats).toHaveBeenCalledTimes(4);
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

                await jest.advanceTimersByTimeAsync(50);
                rtcManager.updateStreamResolution("stream1", null, { width: 1000, height: 1000 });

                await jest.advanceTimersByTimeAsync(100);
                await jest.advanceTimersByTimeAsync(100);

                expect(consumer.getStats).toHaveBeenCalledTimes(4);
                expect(rtcManager._preferredLayerSwitchLatencyStats.count).toBe(1);
                expect(rtcManager.analytics.avgPreferredLayerSwitchLatencyMs).toBe(200);
            });

            it("does not mistake an earlier switch that is still landing for a quick reverse switch", async () => {
                const consumer = createConsumerWithFrameSizes([
                    { width: 960, height: 540 }, // 2->0 watch's baseline
                    { width: 960, height: 540 }, // 0->2 watch's baseline, taken before the 2->0 switch landed
                    { width: 480, height: 270 }, // the 2->0 switch landing
                    { width: 960, height: 540 }, // back at layer 2
                ]);
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });
                rtcManager.updateStreamResolution("stream1", null, { width: 1000, height: 1000 });

                await jest.advanceTimersByTimeAsync(10_000);

                expect(consumer.getStats.mock.calls.length).toBeGreaterThanOrEqual(4);
                expect(rtcManager._preferredLayerSwitchLatencyStats.count).toBe(0);
            });

            it("does not record the time to the first decoded frame as a switch", async () => {
                // The test protects the switch-latency average from new videos. Without it, every newly started
                // video could add its start-up time to the average as if it were a layer switch.
                const consumer = createConsumerWithFrameSizes(
                    [
                        // inbound-rtp exists, but nothing decoded yet
                        {} as any,
                        { width: 960, height: 540 },
                    ],
                    { spatialLayer: 0 },
                );
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 1000, height: 1000 });

                await jest.advanceTimersByTimeAsync(10_000);

                expect(rtcManager._preferredLayerSwitchLatencyStats.count).toBe(0);
                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(0);
            });

            it("records a switch to a higher layer once the frame size grows", async () => {
                const consumer = createConsumerWithFrameSizes(
                    [
                        { width: 480, height: 270 },
                        { width: 960, height: 540 },
                    ],
                    { spatialLayer: 0 },
                );
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 1000, height: 1000 });

                await jest.advanceTimersByTimeAsync(100);

                expect(rtcManager._preferredLayerSwitchLatencyStats.count).toBe(1);
                expect(rtcManager.analytics.avgPreferredLayerSwitchLatencyMs).toBe(100);
            });

            it("only watches 5 switches at a time, e.g. when a layout change switches every consumer", async () => {
                // each watch polls getStats() every 100 ms, so without a limit a layout change in a large meeting
                // would cause a spike of getStats() calls, one watch for every switched consumer
                const consumers = Array.from({ length: 7 }, (_, index) => {
                    const consumer = createConsumerWithFrameSizes([{ width: 960, height: 540 }]);
                    registerConsumer(`stream${index}`, `consumer${index}`, consumer);
                    return consumer;
                });

                consumers.forEach((_, index) =>
                    rtcManager.updateStreamResolution(`stream${index}`, null, { width: 100, height: 100 }),
                );
                await jest.advanceTimersByTimeAsync(0);

                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(5);
                expect(consumers.filter((consumer) => consumer.getStats.mock.calls.length > 0)).toHaveLength(5);

                // a newer switch of a watched consumer still replaces its watch
                rtcManager.updateStreamResolution("stream0", null, { width: 1000, height: 1000 });
                await jest.advanceTimersByTimeAsync(0);

                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(5);
                expect(consumers[0].getStats).toHaveBeenCalledTimes(2);
            });

            it("stops watching once the consumer closes", async () => {
                const consumer = createConsumerWithFrameSizes([{ width: 960, height: 540 }]);
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });
                await jest.advanceTimersByTimeAsync(0);

                consumer.closed = true;

                await jest.advanceTimersByTimeAsync(500);

                expect(consumer.getStats).toHaveBeenCalledTimes(1);
                expect(rtcManager._preferredLayerSwitchLatencyStats.count).toBe(0);
                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(0);
            });

            it("stops all watches on disconnectAll", async () => {
                const consumer = createConsumerWithFrameSizes([{ width: 960, height: 540 }]);
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });
                await jest.advanceTimersByTimeAsync(0);
                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(1);

                rtcManager.disconnectAll();
                await jest.advanceTimersByTimeAsync(10_000);

                expect(consumer.getStats).toHaveBeenCalledTimes(1);
                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(0);
            });

            it("does not record a sample from a poll that was already in flight when the watch was stopped", async () => {
                let resolveStats: ((stats: any[]) => void) | undefined;
                const consumer = createConsumerWithFrameSizes([{ width: 960, height: 540 }]);
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });
                await jest.advanceTimersByTimeAsync(0);

                consumer.getStats.mockImplementationOnce(
                    () =>
                        new Promise((resolve) => {
                            resolveStats = resolve;
                        }),
                );
                await jest.advanceTimersByTimeAsync(500);

                rtcManager.disconnectAll();
                resolveStats!([{ type: "inbound-rtp", frameWidth: 480, frameHeight: 270 }]);
                await jest.advanceTimersByTimeAsync(0);

                expect(rtcManager._preferredLayerSwitchLatencyStats.count).toBe(0);
            });

            it("does not record anything, or throw, when there's no inbound-rtp report to baseline against", async () => {
                const consumer = createConsumerWithFrameSizes([]);
                registerConsumer("stream1", "consumer1", consumer);

                rtcManager.updateStreamResolution("stream1", null, { width: 100, height: 100 });

                await jest.advanceTimersByTimeAsync(10_000);

                expect(rtcManager._preferredLayerSwitchLatencyStats.count).toBe(0);
                expect(rtcManager._preferredLayerSwitchWatches.size).toBe(0);
            });

            it("aggregates avg across multiple recorded samples", () => {
                Array.from({ length: 20 }, (_, i) => (i + 1) * 50).forEach((latencyMs) => {
                    rtcManager._recordPreferredLayerSwitchLatency(latencyMs);
                });

                expect(rtcManager._preferredLayerSwitchLatencyStats.count).toBe(20);
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

        const webcamMid = "1";
        const out = (ssrcMetrics: any = {}) => makeStatsByView({ direction: "out", mid: webcamMid, ...ssrcMetrics });

        beforeEach(() => {
            // only our own webcam upload (producer) is tracked - mic, screenshare, and every remote peer's inbound
            // video are excluded
            rtcManager._webcamProducer = { track: { id: webcamTrackId }, rtpParameters: { mid: webcamMid } };
        });

        it("ignores inbound streams and other transceivers' streams", () => {
            rtcManager._onUpdatedStats(
                makeStatsByView({ direction: "in", mid: webcamMid, roundTripTime: 0.05, remoteReportTimestamp: 1 }),
            );
            rtcManager._onUpdatedStats(
                makeStatsByView(
                    { direction: "out", mid: "0", roundTripTime: 0.05, remoteReportTimestamp: 2 },
                    { trackId: "mic-track" },
                ),
            );

            expect(rtcManager._camOutboundSamples.total).toBe(0);
        });

        describe("with the send transport's peer connection known", () => {
            const sendTransportPc = {};

            beforeEach(() => {
                rtcManager._sendTransport = { handler: { _pc: sendTransportPc } } as any;
                jest.spyOn(peerConnectionTracker, "getPeerConnectionIndex").mockImplementation((pc) =>
                    pc === sendTransportPc ? 3 : undefined,
                );
            });

            afterEach(() => {
                jest.restoreAllMocks();
            });

            it("only takes the webcam's mid from the send transport's peer connection", () => {
                // e.g. the bandwidth tester's own send transport, whose video is on the same mid, on another route
                const otherPcStream = { pcIndex: 7, selectedCandidatePairId: "other" };

                [1, 2, 3, 4].forEach((remoteReportTimestamp) =>
                    rtcManager._onUpdatedStats({
                        ...out({
                            pcIndex: 3,
                            roundTripTime: 0.05,
                            remoteReportTimestamp,
                            selectedCandidatePairId: "direct",
                        }),
                        client2: {
                            tracks: {
                                "other-track": {
                                    ssrcs: {
                                        "2": {
                                            direction: "out",
                                            mid: webcamMid,
                                            roundTripTime: 0.5,
                                            remoteReportTimestamp,
                                            ...otherPcStream,
                                        },
                                    },
                                },
                            },
                        },
                    }),
                );

                // no samples skipped for a pair change, and none from the other peer connection's stream
                expect(rtcManager._camOutboundSamples.total).toBe(4);
                expect(rtcManager.analytics.camOutboundRttInflationMs).toBe(0);
            });
        });

        it("keeps finding the webcam's streams after its track is replaced", () => {
            // outbound stats have no track id, so they may still be filed under the previous track
            rtcManager._webcamProducer.track = { id: "replaced-webcam-track" };

            rtcManager._onUpdatedStats(out({ roundTripTime: 0.05, remoteReportTimestamp: 1 }));

            expect(rtcManager._camOutboundSamples.total).toBe(1);
        });

        // one outbound ssrc per simulcast layer, all reported in the same stats poll
        const simulcast = (...reports: any[]) => ({
            client1: {
                tracks: {
                    [webcamTrackId]: {
                        ssrcs: Object.fromEntries(
                            reports.map((report, index) => [
                                String(index + 1),
                                { direction: "out", mid: webcamMid, ...report },
                            ]),
                        ),
                    },
                },
            },
        });

        it("skips an ssrc the SFU hasn't sent a remote report for yet", () => {
            // lossy enough to count as congested, if it were sampled
            rtcManager._onUpdatedStats(out({ fractionLost: 0.05 }));
            rtcManager._onUpdatedStats(out({ fractionLost: 0.05 }));

            expect(rtcManager._camOutboundSamples.total).toBe(0);
            expect(rtcManager.analytics.camOutboundCongestedFraction).toBeUndefined();
        });

        it("takes one sample per stats poll from its new simulcast reports", () => {
            rtcManager._onUpdatedStats(
                simulcast(
                    { roundTripTime: 0.05, fractionLost: 0, remoteReportTimestamp: 1 },
                    { roundTripTime: 0.06, fractionLost: 0.05, remoteReportTimestamp: 1 },
                ),
            );

            expect(rtcManager._camOutboundSamples).toEqual({ total: 1, congested: 1 });
            expect(rtcManager._camOutboundPathRtt).toMatchObject({ sumMs: 60, count: 1 });
        });

        it("weighs each simulcast layer's packet loss by its packets, not just one random loss on the lowest layer", () => {
            rtcManager._onUpdatedStats(
                simulcast(
                    // 1 of the lowest layer's 15 packets lost is 6.7%, but only 0.3% of the upload
                    { fractionLost: 1 / 15, packetRate: 15, remoteReportTimestamp: 1 },
                    { fractionLost: 0, packetRate: 300, remoteReportTimestamp: 1 },
                ),
            );

            expect(rtcManager.analytics.camOutboundCongestedFraction).toBe(0);
        });

        it("doesn't let a layer that stopped reporting (e.g. switched off under congestion) outweigh congestion", () => {
            rtcManager._onUpdatedStats(
                simulcast(
                    { roundTripTime: 0.05, remoteReportTimestamp: 1 },
                    { roundTripTime: 0.05, remoteReportTimestamp: 1 },
                    { roundTripTime: 0.05, remoteReportTimestamp: 1 },
                ),
            );
            // the top layer's report is now repeated, the others are new and congested
            rtcManager._onUpdatedStats(
                simulcast(
                    { roundTripTime: 0.05, fractionLost: 0.05, remoteReportTimestamp: 2 },
                    { roundTripTime: 0.05, fractionLost: 0.05, remoteReportTimestamp: 2 },
                    { roundTripTime: 0.05, remoteReportTimestamp: 1 },
                ),
            );

            expect(rtcManager.analytics.camOutboundCongestedFraction).toBe(0.5);
        });

        it("measures the time queued against each webcam producer's own path, e.g. after a reconnect", () => {
            rtcManager._onUpdatedStats(out({ roundTripTime: 0.05, remoteReportTimestamp: 1 }));
            rtcManager._onUpdatedStats(out({ roundTripTime: 0.07, remoteReportTimestamp: 2 }));

            // the webcam producer closes, and a new one takes a longer path
            rtcManager._stopWebcamStatsSubscription();
            rtcManager._onUpdatedStats(out({ roundTripTime: 0.2, remoteReportTimestamp: 3 }));
            rtcManager._onUpdatedStats(out({ roundTripTime: 0.22, remoteReportTimestamp: 4 }));

            expect(rtcManager.analytics.camOutboundCongestedFraction).toBe(0);
            expect(rtcManager.analytics.camOutboundRttInflationMs).toBe(10);
        });

        it("measures the time queued against each candidate pair's own path, e.g. after an ICE restart", () => {
            const report = (roundTripTime: number, remoteReportTimestamp: number, selectedCandidatePairId: string) =>
                out({ roundTripTime, remoteReportTimestamp, selectedCandidatePairId });

            rtcManager._onUpdatedStats(report(0.05, 1, "direct"));
            rtcManager._onUpdatedStats(report(0.07, 2, "direct"));
            // same webcam producer, but now relayed through TURN
            rtcManager._onUpdatedStats(report(0.2, 3, "relayed"));
            rtcManager._onUpdatedStats(report(0.2, 4, "relayed"));
            rtcManager._onUpdatedStats(report(0.2, 5, "relayed"));
            rtcManager._onUpdatedStats(report(0.22, 6, "relayed"));

            expect(rtcManager.analytics.camOutboundCongestedFraction).toBe(0);
            expect(rtcManager.analytics.camOutboundRttInflationMs).toBe(10);
        });

        it("skips the first 2 samples after a candidate pair change, so they can't set the new path's lowest round-trip time", () => {
            const report = (roundTripTime: number, remoteReportTimestamp: number, selectedCandidatePairId: string) =>
                out({ roundTripTime, remoteReportTimestamp, selectedCandidatePairId });

            rtcManager._onUpdatedStats(report(0.03, 1, "wifi"));
            // switched to LTE: the first report was still received over wifi, the next one is half over each route
            rtcManager._onUpdatedStats(report(0.03, 2, "lte"));
            rtcManager._onUpdatedStats(report(0.08, 3, "lte"));
            rtcManager._onUpdatedStats(report(0.13, 4, "lte"));
            rtcManager._onUpdatedStats(report(0.14, 5, "lte"));

            expect(rtcManager.analytics.camOutboundCongestedFraction).toBe(0);
            expect(rtcManager._camOutboundPathRtt).toMatchObject({ count: 2, minMs: 130 });
        });

        it("keeps measuring against the same path while the candidate pair stays the same", () => {
            rtcManager._onUpdatedStats(
                out({ roundTripTime: 0.05, remoteReportTimestamp: 1, selectedCandidatePairId: "direct" }),
            );
            rtcManager._onUpdatedStats(
                out({ roundTripTime: 0.2, remoteReportTimestamp: 2, selectedCandidatePairId: "direct" }),
            );

            expect(rtcManager.analytics.camOutboundCongestedFraction).toBe(0.5);
            // averaged over the 2 samples, against the path's lowest round-trip time: (0 + 150 ms) / 2
            expect(rtcManager.analytics.camOutboundRttInflationMs).toBe(75);
        });

        describe("round-trip time", () => {
            it("reports how far the round-trip time is above its lowest, on average", () => {
                [0.05, 0.05, 0.08, 0.2].forEach((roundTripTime, index) =>
                    rtcManager._onUpdatedStats(out({ roundTripTime, remoteReportTimestamp: index })),
                );

                expect(rtcManager.analytics.camOutboundRttInflationMs).toBe(45);
            });

            it("samples it once per remote report, not on every stats poll that repeats it", () => {
                rtcManager._onUpdatedStats(out({ roundTripTime: 0.05, remoteReportTimestamp: 1 }));
                rtcManager._onUpdatedStats(out({ roundTripTime: 0.05, remoteReportTimestamp: 1 }));

                expect(rtcManager._camOutboundPathRtt.count).toBe(1);
            });

            it("ignores a report without a measurement yet", () => {
                rtcManager._onUpdatedStats(out({ roundTripTime: 0, remoteReportTimestamp: 1 }));

                expect(rtcManager.analytics.camOutboundRttInflationMs).toBeUndefined();
            });
        });

        describe("camOutboundCongestedFraction", () => {
            it("counts the samples where the upload was queued or losing packets, not bandwidth limited", () => {
                [
                    { roundTripTime: 0.05 }, // baseline
                    { roundTripTime: 0.06 }, // 10 ms queued: fine
                    { roundTripTime: 0.2 }, // 150 ms queued: congested
                    { roundTripTime: 0.05, fractionLost: 0.05 }, // losing packets: congested
                    { roundTripTime: 0.05, qualityLimitationReason: "bandwidth" }, // demand above the estimate: fine
                ].forEach((report, index) =>
                    rtcManager._onUpdatedStats(out({ ...report, remoteReportTimestamp: index })),
                );

                expect(rtcManager.analytics.camOutboundCongestedFraction).toBe(0.4);
            });

            it("only counts each remote report once", () => {
                rtcManager._onUpdatedStats(out({ fractionLost: 0.05, remoteReportTimestamp: 1 }));
                rtcManager._onUpdatedStats(out({ fractionLost: 0.05, remoteReportTimestamp: 1 }));
                rtcManager._onUpdatedStats(out({ fractionLost: 0, remoteReportTimestamp: 2 }));

                expect(rtcManager.analytics.camOutboundCongestedFraction).toBe(0.5);
            });
        });
    });
});
