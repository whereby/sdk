import { randomMediaStream, randomRemoteParticipant } from "../../__mocks__/appMocks";
import { RootState } from "../../redux";
import { RemoteParticipant } from "../../RoomParticipant";
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

    describe("when the room changes", () => {
        const isPlainObject = (value: unknown): value is Record<string, unknown> =>
            value !== null &&
            typeof value === "object" &&
            [Object.prototype, null].includes(Object.getPrototypeOf(value));

        // Compares plain objects and arrays by their contents, and anything else (streams, class instances) by identity
        const hasEqualContents = (a: unknown, b: unknown): boolean => {
            if (a === b) {
                return true;
            }
            if (Array.isArray(a) && Array.isArray(b)) {
                return a.length === b.length && a.every((item, i) => hasEqualContents(item, b[i]));
            }
            if (isPlainObject(a) && isPlainObject(b)) {
                const keys = Object.keys(a);
                return keys.length === Object.keys(b).length && keys.every((key) => hasEqualContents(a[key], b[key]));
            }
            return false;
        };

        const presenter = randomRemoteParticipant({
            id: "presenter",
            stream: randomMediaStream(),
            presentationStream: randomMediaStream(),
        });
        const participant = randomRemoteParticipant({ id: "participant", stream: randomMediaStream() });

        const scenarios: Record<string, (state: RootState) => RootState> = {
            "without breakout groups": (state) => state,
            "in the main room of a breakout session": (state) => ({
                ...state,
                breakout: { ...state.breakout, startedAt: new Date(1), groups: { group: "Group" } },
                remoteParticipants: {
                    ...state.remoteParticipants,
                    remoteParticipants: [presenter, { ...participant, breakoutGroup: "group" }],
                },
            }),
            "in a breakout group": (state) => ({
                ...state,
                breakout: { ...state.breakout, startedAt: new Date(1), groups: { group: "Group" } },
                localParticipant: { ...state.localParticipant, breakoutGroup: "group" },
                remoteParticipants: {
                    ...state.remoteParticipants,
                    remoteParticipants: [presenter, { ...participant, breakoutGroup: "group" }],
                },
            }),
        };

        const updateParticipant = (state: RootState, update: Partial<RemoteParticipant>) => ({
            ...state,
            remoteParticipants: {
                ...state.remoteParticipants,
                remoteParticipants: state.remoteParticipants.remoteParticipants.map((p) =>
                    p.id === participant.id ? { ...p, ...update } : p,
                ),
            },
        });

        const changes: Record<string, (state: RootState) => RootState> = {
            "a remote participant mutes": (state) => updateParticipant(state, { isAudioEnabled: false }),
            "a remote participant changes their name": (state) => updateParticipant(state, { displayName: "Renamed" }),
            "a remote participant joins": (state) => ({
                ...state,
                remoteParticipants: {
                    ...state.remoteParticipants,
                    remoteParticipants: [
                        ...state.remoteParticipants.remoteParticipants,
                        randomRemoteParticipant({ stream: randomMediaStream() }),
                    ],
                },
            }),
            "the local participant mutes": (state) => ({
                ...state,
                localParticipant: { ...state.localParticipant, isAudioEnabled: false },
            }),
            "the local participant changes their name": (state) => ({
                ...state,
                localParticipant: { ...state.localParticipant, displayName: "Renamed" },
            }),
            "a participant is spotlighted": (state) => ({
                ...state,
                spotlights: { ...state.spotlights, sorted: [{ clientId: participant.id, streamId: "0" }] },
            }),
            "a chat message is sent": (state) => ({
                ...state,
                chat: {
                    ...state.chat,
                    chatMessages: [
                        ...state.chat.chatMessages,
                        { id: "1", senderId: participant.id, timestamp: "", text: "Hello", removed: false },
                    ],
                },
            }),
        };

        const cases = Object.entries(scenarios).flatMap(([scenario, setUpScenario]) =>
            Object.entries(changes).map(([change, makeChange]) => ({ scenario, setUpScenario, change, makeChange })),
        );

        it.each(cases)(
            "$scenario, when $change, only gives new values to keys whose contents changed",
            ({ setUpScenario, makeChange }) => {
                const before = setUpScenario({
                    ...state,
                    localParticipant: { ...state.localParticipant, id: "self", displayName: "Me" },
                    remoteParticipants: { ...state.remoteParticipants, remoteParticipants: [presenter, participant] },
                });
                const after = makeChange(before);

                const keysWithNewEqualValues = keys
                    .filter(({ selector }) => {
                        const value = selector(before);
                        const newValue = selector(after);
                        return value !== newValue && hasEqualContents(value, newValue);
                    })
                    .map(({ name }) => name);

                expect(keysWithNewEqualValues).toEqual([]);
            },
        );
    });
});
