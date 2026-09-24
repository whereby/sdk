import { diff } from "deep-object-diff";
import { doStartScreenshare, doStopScreenshare } from "../../slices/localScreenshare";
import { selectRoomConnectionState } from "../../../client/RoomConnection/selector";
import { createStore, mockRtcManager } from "../store.setup";

import MockMediaStream from "../../../__mocks__/MediaStream";

Object.defineProperty(navigator, "mediaDevices", {
    writable: true,
    value: {
        getDisplayMedia: jest.fn(),
    },
});

const mockedGetDisplayMedia = jest.mocked(navigator.mediaDevices.getDisplayMedia);

describe("actions", () => {
    let stream: MediaStream;

    beforeEach(() => {
        stream = new MockMediaStream();
    });

    it("doStartScreenshare", async () => {
        mockedGetDisplayMedia.mockResolvedValue(stream);
        const store = createStore({
            withRtcManager: true,
            connectToRoom: true,
        });

        const before = store.getState().localScreenshare;

        await store.dispatch(doStartScreenshare());

        const after = store.getState().localScreenshare;

        expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalled();
        expect(mockRtcManager.addScreenshareStream).toHaveBeenCalledWith(stream);
        expect(diff(before, after)).toEqual({
            status: "active",
            stream,
            startedAt: expect.any(Number),
        });
    });

    it("doStopScreenshare", async () => {
        mockedGetDisplayMedia.mockResolvedValue(stream);
        const store = createStore({
            withRtcManager: true,
            connectToRoom: true,
        });

        await store.dispatch(doStartScreenshare());

        const before = store.getState().localScreenshare;

        store.dispatch(doStopScreenshare());

        const after = store.getState().localScreenshare;

        expect(diff(before, after)).toEqual({
            status: "inactive",
            stream: undefined,
        });
    });
});

describe("room connection state", () => {
    let stream: MediaStream;

    beforeEach(() => {
        stream = new MockMediaStream();
        mockedGetDisplayMedia.mockResolvedValue(stream);
    });

    it("exposes localScreenshare state while screensharing", async () => {
        const store = createStore({
            withRtcManager: true,
            connectToRoom: true,
        });

        expect(selectRoomConnectionState(store.getState())).toMatchObject({
            localScreenshareStatus: undefined,
            localScreenshare: undefined,
            localParticipant: { isScreenSharing: false },
        });

        await store.dispatch(doStartScreenshare());

        expect(selectRoomConnectionState(store.getState())).toMatchObject({
            localScreenshareStatus: "active",
            localScreenshare: {
                status: "screensharing",
                error: undefined,
                startedAt: expect.any(Number),
            },
            localParticipant: { isScreenSharing: true },
        });

        store.dispatch(doStopScreenshare());

        expect(selectRoomConnectionState(store.getState())).toMatchObject({
            localScreenshareStatus: undefined,
            localScreenshare: undefined,
            localParticipant: { isScreenSharing: false },
        });
    });
});
