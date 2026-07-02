// Temporary suite for the `_sfuZombie` telemetry — how long the SFU WebSocket stays open ("zombie":
// alive to the OS, dead in reality) after the browser reports offline, until it actually closes.
// Expected to be removed together with the instrumentation once the question it answers is settled.
//
// Driven through real edges — a browser `offline` event and `_onClose` (the SFU WS close handler) —
// and asserted only at the edges: the `analytics` values that spread onto `Room: exited`, and the
// `rtcStats` events. The two preconditions (an SFU WS exists; the room is joined) are set directly,
// since reaching them for real needs the whole connect flow and isn't what's under test. Date.now is
// mocked so the elapsed times are deterministic.

import VegaRtcManager from "../";
import * as helpers from "../../../../tests/webrtc/webRtcHelpers";
import rtcStats from "../../rtcStatsService";

jest.mock("../../../utils/getMediasoupDevice");
const { getMediasoupDeviceAsync } = jest.requireMock("../../../utils/getMediasoupDevice");

jest.mock("webrtc-adapter", () => ({
    browserDetails: { browser: "chrome" },
}));

const originalNavigator = global.navigator;

describe("VegaRtcManager _sfuZombie", () => {
    let rtcManager: any;
    let serverSocketStub: ReturnType<typeof helpers.createServerSocketStub>;
    let sendEvent: jest.SpyInstance;
    let now: jest.SpyInstance;

    const at = (ms: number) => now.mockReturnValue(ms);
    const browserOffline = () => window.dispatchEvent(new Event("offline"));
    const analytics = () => rtcManager.analytics;
    const offlineEvents = () => sendEvent.mock.calls.filter((c) => c[0] === "SfuOfflineWhileConnected");

    beforeEach(() => {
        now = jest.spyOn(Date, "now").mockReturnValue(0);

        getMediasoupDeviceAsync.mockImplementation(() => ({}));
        serverSocketStub = helpers.createServerSocketStub();
        sendEvent = jest.spyOn(rtcStats, "sendEvent").mockImplementation(() => undefined);

        Object.defineProperty(global, "navigator", {
            value: { mediaDevices: {} },
            configurable: true,
        });

        rtcManager = new VegaRtcManager({
            selfId: helpers.randomString("client-"),
            room: {
                iceServers: { iceServers: [] },
                sfuServer: { url: "wss://localhost:1" },
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
            emitter: helpers.createEmitterStub(),
            serverSocket: serverSocketStub.socket,
            webrtcProvider: { getMediaOptions: () => ({}) } as any,
            features: {},
            eventClaim: helpers.randomString("/claim-"),
        });

        // Precondition: we hold an SFU WS.
        rtcManager._isConnectingOrConnected = true;
    });

    afterEach(() => {
        rtcManager.disconnectAll();
        jest.restoreAllMocks();
        Object.defineProperty(global, "navigator", { value: originalNavigator, configurable: true });
    });

    it("ignores a browser offline when we hold no SFU connection", () => {
        rtcManager._isConnectingOrConnected = false;

        browserOffline();

        expect(offlineEvents()).toHaveLength(0);
        expect(analytics().sfuOfflineWhileConnectedCount).toBe(0);
    });

    it("records a single offline while connected and emits SfuOfflineWhileConnected", () => {
        browserOffline();
        at(2000);
        browserOffline();

        expect(offlineEvents()).toHaveLength(1);
        expect(analytics().sfuOfflineWhileConnectedCount).toBe(1);
    });

    it("banks offline→close and tags SfuConnectionClosed with the gap", () => {
        at(1000);
        browserOffline();

        at(57000);
        rtcManager._onClose();

        expect(analytics().sfuMsFromOfflineToClose).toBe(56000);
        expect(sendEvent).toHaveBeenCalledWith("SfuConnectionClosed", { msFromOfflineToClose: 56000 });
    });

    it("captures the in-progress gap when the user leaves while still a zombie", () => {
        at(1000);
        browserOffline();

        at(30000);
        rtcManager.disconnectAll();

        expect(analytics().sfuMsFromOfflineToClose).toBe(29000);
    });

    it("records no gap for a close that was not preceded by an offline", () => {
        rtcManager._onClose();

        expect(analytics().sfuMsFromOfflineToClose).toBe(0);
        expect(sendEvent).toHaveBeenCalledWith("SfuConnectionClosed", { msFromOfflineToClose: undefined });
    });
});
