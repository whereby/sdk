import { createStore, mockRtcManager } from "../store.setup";
import { doRtcAnalyticsCustomEventsInitialize, rtcAnalyticsState } from "../../slices/rtcAnalytics";
import { diff } from "deep-object-diff";
import { randomOrganization, randomSignalClient } from "../../../__mocks__/appMocks";
import { setDisplayName } from "../../slices/localParticipant";
import { socketDisconnected, socketReconnecting } from "../../slices/signalConnection";
import { signalEvents } from "../../slices/signalConnection/actions";
import { rtcManagerInitialized } from "../../slices/rtcConnection";
import { RootState } from "../../store";

describe("actions", () => {
    it("doRtcAnalyticsCustomEventsInitialize", async () => {
        const store = createStore({ withRtcManager: true });

        const before = store.getState().rtcAnalytics;

        store.dispatch(doRtcAnalyticsCustomEventsInitialize());

        const after = store.getState().rtcAnalytics;

        const updatedState = diff(before, after) as rtcAnalyticsState;

        expect(Object.keys(updatedState?.reportedValues)).toEqual(
            expect.arrayContaining([
                "audioEnabled",
                "videoEnabled",
                "localScreenshareStream",
                "displayName",
                "clientId",
                "externalId",
                "signalConnectionStatus",
                "rtcConnectionStatus",
                "userRole",
                "roomMode",
                "sfuServer",
            ]),
        );
        expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith("insightsStats", expect.any(Object));
    });
    it("redacts the displayName when hideInsightsDisplayName is true", () => {
        const organization = randomOrganization({ preferences: { hideInsightsDisplayNames: true } });
        const store = createStore({
            withRtcManager: true,
            initialState: {
                organization: { data: organization, isFetching: false, error: null },
            },
        });

        store.dispatch(doRtcAnalyticsCustomEventsInitialize());

        expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith(
            "displayName",
            expect.objectContaining({ displayName: "[[redacted]]" }),
        );
    });
});

describe("userRole", () => {
    it("sends the role name as role", () => {
        const store = createStore({
            withRtcManager: true,
            initialState: {
                authorization: { roomKey: null, assistantKey: null, roleName: "host" },
            },
        });

        store.dispatch(doRtcAnalyticsCustomEventsInitialize());

        expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith(
            "userRole",
            expect.objectContaining({ role: "host" }),
        );
    });
});

describe("middleware", () => {
    describe("displayName", () => {
        it("tracks display name changes", () => {
            const organization = randomOrganization({ preferences: { hideInsightsDisplayNames: false } });
            const store = createStore({
                withRtcManager: true,
                initialState: {
                    organization: { data: organization, isFetching: false, error: null },
                },
            });

            store.dispatch(doRtcAnalyticsCustomEventsInitialize());
            store.dispatch(setDisplayName({ displayName: "Trogdor" }));

            expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith(
                "displayName",
                expect.objectContaining({ displayName: "Trogdor" }),
            );
        });
        it("redacts the displayName when applicable", () => {
            const organization = randomOrganization({ preferences: { hideInsightsDisplayNames: true } });
            const store = createStore({
                withRtcManager: true,
                initialState: {
                    organization: { data: organization, isFetching: false, error: null },
                },
            });

            store.dispatch(doRtcAnalyticsCustomEventsInitialize());
            store.dispatch(setDisplayName({ displayName: "Trogdor" }));

            expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith(
                "displayName",
                expect.objectContaining({ displayName: "[[redacted]]" }),
            );
        });
    });
    describe("values without actions", () => {
        it("sends signalConnectionStatus on every change after initialization", () => {
            const store = createStore({ withRtcManager: true, withSignalConnection: true });
            store.dispatch(doRtcAnalyticsCustomEventsInitialize());
            mockRtcManager.sendStatsCustomEvent.mockClear();

            store.dispatch(socketReconnecting());
            store.dispatch(socketDisconnected());

            expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith(
                "signalConnectionStatus",
                expect.objectContaining({ status: "reconnecting" }),
            );
            expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith(
                "signalConnectionStatus",
                expect.objectContaining({ status: "disconnected" }),
            );
        });

        it("sends rtcConnectionStatus when it changes", () => {
            const store = createStore({ withRtcManager: true, withSignalConnection: true });
            store.dispatch(doRtcAnalyticsCustomEventsInitialize());
            mockRtcManager.sendStatsCustomEvent.mockClear();

            store.dispatch(socketReconnecting());

            expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith(
                "rtcConnectionStatus",
                expect.objectContaining({ status: "reconnecting" }),
            );
        });

        it("sends roomMode when the room switches mode", () => {
            const store = createStore({ withRtcManager: true });
            store.dispatch(doRtcAnalyticsCustomEventsInitialize());
            mockRtcManager.sendStatsCustomEvent.mockClear();

            store.dispatch(
                signalEvents.roomJoined({
                    selfId: "selfId",
                    clientClaim: "client-claim",
                    eventClaim: "",
                    room: {
                        mode: "group",
                        clients: [],
                        knockers: [],
                        spotlights: [],
                        session: null,
                        isClaimed: true,
                        isLocked: false,
                        iceServers: { iceServers: [] },
                        mediaserverConfigTtlSeconds: 0,
                        name: "",
                        organizationId: "",
                        turnServers: [],
                    },
                }),
            );

            expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith(
                "roomMode",
                expect.objectContaining({ roomMode: "group" }),
            );
        });

        it("sends sfuServer when the room is joined, but not again for the same server", () => {
            const store = createStore({ withRtcManager: true });
            store.dispatch(doRtcAnalyticsCustomEventsInitialize());
            mockRtcManager.sendStatsCustomEvent.mockClear();

            const roomJoinedEvent = () =>
                signalEvents.roomJoined({
                    selfId: "selfId",
                    clientClaim: "client-claim",
                    eventClaim: "",
                    room: {
                        mode: "group",
                        sfuServer: { url: "sfu.example.com:443" },
                        clients: [],
                        knockers: [],
                        spotlights: [],
                        session: null,
                        isClaimed: true,
                        isLocked: false,
                        iceServers: { iceServers: [] },
                        mediaserverConfigTtlSeconds: 0,
                        name: "",
                        organizationId: "",
                        turnServers: [],
                    },
                });
            store.dispatch(roomJoinedEvent());

            expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith(
                "sfuServer",
                expect.objectContaining({ sfuServer: { url: "sfu.example.com:443" } }),
            );

            mockRtcManager.sendStatsCustomEvent.mockClear();
            store.dispatch(roomJoinedEvent());

            expect(mockRtcManager.sendStatsCustomEvent).not.toHaveBeenCalledWith("sfuServer", expect.anything());
        });
    });

    describe("before the RtcManager is initialized", () => {
        it("doesn't send changes until initialization, which sends insightsStats first", () => {
            const store = createStore({
                withRtcManager: true,
                withSignalConnection: true,
                initialState: {
                    rtcConnection: { rtcManagerInitialized: false } as RootState["rtcConnection"],
                },
            });

            store.dispatch(socketReconnecting());

            expect(mockRtcManager.sendStatsCustomEvent).not.toHaveBeenCalled();

            store.dispatch(rtcManagerInitialized());

            const sentEvents = mockRtcManager.sendStatsCustomEvent.mock.calls.map(([type]) => type);
            expect(sentEvents[0]).toBe("insightsStats");
            expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith(
                "signalConnectionStatus",
                expect.objectContaining({ status: "reconnecting" }),
            );
        });
    });

    describe("values with actions", () => {
        it("doesn't send an object value again when it hasn't changed", () => {
            const store = createStore({ withRtcManager: true });
            store.dispatch(doRtcAnalyticsCustomEventsInitialize());
            mockRtcManager.sendStatsCustomEvent.mockClear();

            store.dispatch(signalEvents.newClient({ client: randomSignalClient() }));

            expect(mockRtcManager.sendStatsCustomEvent).not.toHaveBeenCalledWith("recording", expect.anything());
            expect(mockRtcManager.sendStatsCustomEvent).not.toHaveBeenCalledWith("transcribing", expect.anything());
        });
    });
});
