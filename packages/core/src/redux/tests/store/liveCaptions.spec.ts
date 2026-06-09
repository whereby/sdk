import { createStore, mockSignalEmit } from "../store.setup";
import { doStartLiveCaptions, doStopLiveCaptions, initialLiveCaptionsState } from "../../slices/liveCaptions";
import { diff } from "deep-object-diff";

describe("actions", () => {
    describe("doStartLiveCaptions", () => {
        it("should start captioning", () => {
            const store = createStore({ withSignalConnection: true, connectToRoom: true });

            const before = store.getState().liveCaptions;

            store.dispatch(doStartLiveCaptions());

            const after = store.getState().liveCaptions;

            expect(mockSignalEmit).toHaveBeenCalledWith("live_captions_enabled");

            expect(diff(before, after)).toEqual({
                status: "requested",
            });
        });

        it("should not start captioning if already captioning", () => {
            const store = createStore({
                withSignalConnection: true,
                connectToRoom: true,
                initialState: {
                    liveCaptions: {
                        ...initialLiveCaptionsState,
                        isCaptioning: true,
                        status: "captioning",
                    },
                },
            });

            store.dispatch(doStartLiveCaptions());

            expect(mockSignalEmit).not.toHaveBeenCalled();
        });
    });

    it("doStopLiveCaptions", () => {
        const store = createStore({
            withSignalConnection: true,
            connectToRoom: true,
            initialState: {
                liveCaptions: {
                    ...initialLiveCaptionsState,
                    isCaptioning: true,
                    status: "captioning",
                },
            },
        });

        store.dispatch(doStopLiveCaptions());

        expect(mockSignalEmit).toHaveBeenCalledWith("live_captions_disabled");
    });
});
