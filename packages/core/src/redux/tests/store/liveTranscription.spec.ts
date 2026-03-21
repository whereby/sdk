import { createStore, mockSignalEmit } from "../store.setup";
import {
    doStartLiveTranscription,
    doStopLiveTranscription,
    initialLiveTranscriptionState,
} from "../../slices/liveTranscription";
import { diff } from "deep-object-diff";

describe("actions", () => {
    describe("doStartLiveTranscription", () => {
        it("should start transcribing", () => {
            const store = createStore({ withSignalConnection: true, connectToRoom: true });

            const before = store.getState().liveTranscription;

            store.dispatch(doStartLiveTranscription());

            const after = store.getState().liveTranscription;

            expect(mockSignalEmit).toHaveBeenCalledWith("start_live_transcription");
            expect(diff(before, after)).toEqual({
                status: "requested",
                isInitiator: true,
            });
        });

        it("should not start transcribing if already transcribing", () => {
            const store = createStore({
                withSignalConnection: true,
                connectToRoom: true,
                initialState: {
                    liveTranscription: {
                        ...initialLiveTranscriptionState,
                        isTranscribing: true,
                        status: "transcribing",
                    },
                },
            });

            store.dispatch(doStartLiveTranscription());

            expect(mockSignalEmit).not.toHaveBeenCalled();
        });
    });

    it("doStopLiveTranscription", () => {
        const store = createStore({
            withSignalConnection: true,
            connectToRoom: true,
            initialState: {
                liveTranscription: {
                    ...initialLiveTranscriptionState,
                    isTranscribing: true,
                    status: "transcribing",
                },
            },
        });

        store.dispatch(doStopLiveTranscription());

        expect(mockSignalEmit).toHaveBeenCalledWith("stop_live_transcription");
    });
});
