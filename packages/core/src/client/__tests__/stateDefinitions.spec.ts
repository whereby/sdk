import { randomMediaStream, randomRemoteParticipant } from "../../__mocks__/appMocks";
import { RootState } from "../../redux";
import { createStore } from "../../redux/tests/store.setup";
import { StateDefinition } from "../BaseClient";
import { gridStateDefinition } from "../Grid/state";
import { localMediaStateDefinition } from "../LocalMedia/state";
import { roomConnectionStateDefinition } from "../RoomConnection/state";

const definitions: Record<string, StateDefinition<object, Record<string, unknown[]>>> = {
    grid: gridStateDefinition,
    localMedia: localMediaStateDefinition,
    roomConnection: roomConnectionStateDefinition,
};

// A selector that gives a new value when nothing it depends on changed notifies its key's
// subscribers on every store update. This checks every key of every client's state for that.
describe("state definitions", () => {
    let state: RootState;

    beforeEach(() => {
        const initialState = createStore().getState();
        const participant = randomRemoteParticipant({
            stream: randomMediaStream(),
            presentationStream: randomMediaStream(),
        });

        // Gives the keys that are only set while something is active a value
        state = {
            ...initialState,
            cloudRecording: { ...initialState.cloudRecording, status: "recording", startedAt: 1 },
            liveCaptions: { ...initialState.liveCaptions, status: "captioning", startedAt: 1 },
            liveTranscription: { ...initialState.liveTranscription, status: "transcribing", startedAt: 1 },
            localScreenshare: { ...initialState.localScreenshare, status: "active", startedAt: 1 },
            remoteParticipants: { ...initialState.remoteParticipants, remoteParticipants: [participant] },
            streaming: { ...initialState.streaming, isStreaming: true, startedAt: 1 },
        };
    });

    const keys = Object.entries(definitions).flatMap(([client, definition]) =>
        Object.entries(definition).map(([key, { selector }]) => ({ name: `${client}.${key}`, key, selector })),
    );

    it.each(keys)("$name gives the same value for the same state", ({ selector }) => {
        expect(selector(state)).toBe(selector(state));
    });

    it.each(keys)("$name gives the same value when an unrelated part of the state changes", ({ key, selector }) => {
        const value = selector(state);
        const unrelatedChange: Partial<RootState> =
            key === "chatMessages"
                ? { fileShare: { ...state.fileShare, uploads: [] } }
                : { chat: { ...state.chat, chatMessages: [] } };

        expect(selector({ ...state, ...unrelatedChange })).toBe(value);
    });
});
