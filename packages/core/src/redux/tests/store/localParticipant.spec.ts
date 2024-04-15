import { doEnableAudio, doEnableVideo, doSetDisplayName } from "../../slices/localParticipant";
import { createStore, mockSignalEmit } from "../store.setup";

describe("actions", () => {
    it("doEnableAudio", async () => {
        const store = createStore({
            withSignalConnection: true,
        });

        await store.dispatch(doEnableAudio({ enabled: true }));

        expect(mockSignalEmit).toHaveBeenCalledWith("enable_audio", { enabled: true });
    });

    it("doEnableVideo", async () => {
        const store = createStore({
            withSignalConnection: true,
        });

        await store.dispatch(doEnableVideo({ enabled: true }));

        expect(mockSignalEmit).toHaveBeenCalledWith("enable_video", { enabled: true });
    });

    it("doSetDisplayName", async () => {
        const store = createStore({
            withSignalConnection: true,
        });

        await store.dispatch(doSetDisplayName({ displayName: "display name" }));

        expect(mockSignalEmit).toHaveBeenCalledWith("send_client_metadata", {
            type: "UserData",
            payload: { displayName: "display name" },
        });
    });
});
