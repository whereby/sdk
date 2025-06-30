import { createStore, mockRtcManager } from "../store.setup";
import { doRtcAnalyticsCustomEventsInitialize, rtcAnalyticsState } from "../../slices/rtcAnalytics";
import { diff } from "deep-object-diff";
import { randomOrganization } from "../../../__mocks__/appMocks";
import { setDisplayName } from "../../slices/localParticipant";

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
});
