import { createStore, mockSignalEmit } from "../store.setup";
import {
    doStartRoomIntegrationWithPicker,
    parseRoomIntegration,
    RoomIntegration,
} from "../../slices/roomIntegrations";
import { localParticipantSliceInitialState } from "../../slices/localParticipant";
import { RoomIntegrationResponse } from "../../../api/roomIntegrationService";

const PICKER_ORIGIN = "https://integrations.whereby.dev";

const youtubeResponse: RoomIntegrationResponse = {
    roomIntegrationId: 5,
    name: "youtube",
    title: "YouTube",
    description: "Watch YouTube videos together in-room.",
    type: "video",
    icons: { large: `${PICKER_ORIGIN}/youtube/large.svg`, small: `${PICKER_ORIGIN}/youtube/small.svg` },
    link: { href: "https://www.youtube.com/", text: "Visit YouTube" },
    entrypoint: `${PICKER_ORIGIN}/youtube/index.4fee6293.mjs`,
    webview: `${PICKER_ORIGIN}/youtube/index.2ad4b051.html`,
    matcher: "/https?:\\/\\/(?:youtu\\.be\\/)([\\w-]{11})/gi",
    isEmbeddable: true,
};

const youtube = parseRoomIntegration(youtubeResponse) as RoomIntegration;

const submission = {
    tagName: "youtube-integration-contentframe",
    shareUrl: "https://youtu.be/dQw4w9WgXcQ",
    props: { videoref: "dQw4w9WgXcQ", seek: 0 },
};

function storeWithCatalog() {
    return createStore({
        withSignalConnection: true,
        connectToRoom: true,
        initialState: {
            localParticipant: { ...localParticipantSliceInitialState, id: "client-1" },
            roomIntegrations: {
                available: [youtube],
                unavailable: [],
                enabled: ["5"],
                running: [],
                isFetching: false,
                hasFetched: true,
                error: null,
            },
        },
    });
}

function mockPopup(popup: { closed: boolean } | null) {
    const open = jest.fn().mockReturnValue(popup);
    Object.defineProperty(window, "open", { value: open, configurable: true, writable: true });
    return open;
}

function fromPicker(type: string, payload: unknown, source: unknown, origin = PICKER_ORIGIN) {
    window.dispatchEvent(
        new MessageEvent("message", { data: { type, payload }, origin, source: source as never }),
    );
}

describe("doStartRoomIntegrationWithPicker", () => {
    it("opens bootstrap.html next to the webview, carrying the parent origin", async () => {
        const store = storeWithCatalog();
        const popup = { closed: false };
        const open = mockPopup(popup);

        const pending = store.dispatch(doStartRoomIntegrationWithPicker({ roomIntegrationId: "5" })).unwrap();

        const url = new URL(open.mock.calls[0][0]);
        expect(url.origin + url.pathname).toEqual(`${PICKER_ORIGIN}/youtube/bootstrap.html`);
        expect(url.searchParams.get("parentOrigin")).toEqual(window.location.origin);

        fromPicker("whereby:formClose", undefined, popup);
        await expect(pending).resolves.toEqual(false);
    });

    it("starts the integration with what the picker returned", async () => {
        const store = storeWithCatalog();
        const popup = { closed: false };
        mockPopup(popup);

        const pending = store.dispatch(doStartRoomIntegrationWithPicker({ roomIntegrationId: "5" })).unwrap();
        fromPicker("whereby:formSubmit", submission, popup);

        await expect(pending).resolves.toEqual(true);
        expect(mockSignalEmit).toHaveBeenCalledWith(
            "start_room_integration",
            expect.objectContaining({
                roomIntegrationId: 5,
                state: expect.objectContaining({ tagName: submission.tagName, shareUrl: submission.shareUrl }),
            }),
        );
    });

    it("resolves false when the user closes the picker without cancelling", async () => {
        // Miro renders its picker inline and detects cancellation by polling a window it does not
        // have, so backing out never sends formClose — a closed popup is the only signal.
        const store = storeWithCatalog();
        const popup = { closed: false };
        mockPopup(popup);

        const pending = store.dispatch(doStartRoomIntegrationWithPicker({ roomIntegrationId: "5" })).unwrap();

        popup.closed = true;
        await jest.advanceTimersByTimeAsync(500);

        await expect(pending).resolves.toEqual(false);
        expect(mockSignalEmit).not.toHaveBeenCalledWith("start_room_integration", expect.anything());
    });

    it("ignores a submission from a window that is not the picker", async () => {
        const store = storeWithCatalog();
        const popup = { closed: false };
        mockPopup(popup);

        const pending = store.dispatch(doStartRoomIntegrationWithPicker({ roomIntegrationId: "5" })).unwrap();
        fromPicker("whereby:formSubmit", submission, window);

        popup.closed = true;
        await jest.advanceTimersByTimeAsync(500);

        await expect(pending).resolves.toEqual(false);
        expect(mockSignalEmit).not.toHaveBeenCalledWith("start_room_integration", expect.anything());
    });

    it("ignores a submission from another origin", async () => {
        const store = storeWithCatalog();
        const popup = { closed: false };
        mockPopup(popup);

        const pending = store.dispatch(doStartRoomIntegrationWithPicker({ roomIntegrationId: "5" })).unwrap();
        fromPicker("whereby:formSubmit", submission, popup, "https://evil.example.com");

        popup.closed = true;
        await jest.advanceTimersByTimeAsync(500);

        await expect(pending).resolves.toEqual(false);
    });

    it("reports a blocked popup rather than hanging", async () => {
        const store = storeWithCatalog();
        mockPopup(null);

        const pending = store.dispatch(doStartRoomIntegrationWithPicker({ roomIntegrationId: "5" })).unwrap();

        // unwrap() rejects with RTK's SerializedError — a plain object, not an Error instance
        await expect(pending).rejects.toMatchObject({ message: expect.stringMatching(/popup was blocked/) });
        expect(store.getState().roomIntegrations.error).toMatch(/popup was blocked/);
    });

    it("surfaces an error the picker reports", async () => {
        const store = storeWithCatalog();
        const popup = { closed: false };
        mockPopup(popup);

        const pending = store.dispatch(doStartRoomIntegrationWithPicker({ roomIntegrationId: "5" })).unwrap();
        fromPicker("whereby:bootstrapError", { message: "Miro said no" }, popup);

        await expect(pending).rejects.toMatchObject({ message: "Miro said no" });
        expect(store.getState().roomIntegrations.error).toEqual("Miro said no");
    });

    it("refuses an integration that is not enabled for the room", async () => {
        const store = createStore({
            withSignalConnection: true,
            connectToRoom: true,
            initialState: {
                roomIntegrations: {
                    available: [youtube],
                    unavailable: [],
                    enabled: [],
                    running: [],
                    isFetching: false,
                    hasFetched: true,
                    error: null,
                },
            },
        });
        const open = mockPopup({ closed: false });

        await expect(
            store.dispatch(doStartRoomIntegrationWithPicker({ roomIntegrationId: "5" })).unwrap(),
        ).rejects.toMatchObject({ message: expect.stringMatching(/not enabled/) });
        expect(open).not.toHaveBeenCalled();
    });
});
