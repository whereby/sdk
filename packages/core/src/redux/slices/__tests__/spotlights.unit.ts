import { CAMERA_STREAM_ID } from "@whereby.com/media";
import { spotlightsSlice } from "../spotlights";
import { signalEvents } from "../signalConnection/actions";

describe("spotlightsSlice", () => {
    describe("reducers", () => {
        describe("signalEvents.spotlightOrderSwapped", () => {
            const a = { clientId: "a", streamId: CAMERA_STREAM_ID };
            const b = { clientId: "b", streamId: "pres-stream" };
            const c = { clientId: "c", streamId: CAMERA_STREAM_ID };
            const state = { sorted: [a, b, c] };

            it("should swap the two spotlights", () => {
                const result = spotlightsSlice.reducer(
                    state,
                    signalEvents.spotlightOrderSwapped({ source: a, target: c, requestedByClientId: "host" }),
                );

                expect(result.sorted).toEqual([c, b, a]);
            });

            it("should match on stream id as well as client id", () => {
                const result = spotlightsSlice.reducer(
                    state,
                    signalEvents.spotlightOrderSwapped({
                        source: { clientId: "b", streamId: CAMERA_STREAM_ID },
                        target: a,
                        requestedByClientId: "host",
                    }),
                );

                expect(result).toBe(state);
            });

            it("should ignore a swap with a spotlight it doesn't know", () => {
                const result = spotlightsSlice.reducer(
                    state,
                    signalEvents.spotlightOrderSwapped({
                        source: a,
                        target: { clientId: "gone", streamId: CAMERA_STREAM_ID },
                        requestedByClientId: "host",
                    }),
                );

                expect(result).toBe(state);
            });

            it("should ignore an error", () => {
                const result = spotlightsSlice.reducer(
                    state,
                    signalEvents.spotlightOrderSwapped({ error: "not_authorized" }),
                );

                expect(result).toBe(state);
            });
        });
    });
});
