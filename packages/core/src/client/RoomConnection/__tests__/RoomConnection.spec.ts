import { RoomConnectionClient } from "..";
import { rtcConnectionSliceInitialState, selectIsAudioOnlyModeEnabled, signalEvents } from "../../../redux";
import { createStore } from "../../../redux/tests/store.setup";

describe("RoomConnection", () => {
    let roomConnectionClient: RoomConnectionClient;
    let store: ReturnType<typeof createStore>;

    beforeEach(() => {
        store = createStore({ connectToRoom: true, withRtcManager: true });
        jest.spyOn(store, "dispatch");
        roomConnectionClient = new RoomConnectionClient(store);
    });

    describe("audioOnlyMode", () => {
        it("can enable and disable audio only mode", () => {
            expect(selectIsAudioOnlyModeEnabled(store.getState())).toEqual(false);

            roomConnectionClient.enableAudioOnlyMode();

            expect(selectIsAudioOnlyModeEnabled(store.getState())).toEqual(true);

            roomConnectionClient.disableAudioOnlyMode();

            expect(selectIsAudioOnlyModeEnabled(store.getState())).toEqual(false);
        });
    });
});
