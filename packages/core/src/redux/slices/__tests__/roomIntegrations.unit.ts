import {
    doStopRoomIntegration,
    parseRoomIntegration,
    parseRoomIntegrationSession,
    roomIntegrationsSlice,
    roomIntegrationsSliceInitialState,
    setRoomIntegrationsError,
    STOP_ROOM_INTEGRATION_NOT_ALLOWED_ERROR,
    selectEmbeddableRoomIntegrations,
    selectEnabledRoomIntegrations,
    selectRoomIntegrationForUrl,
    selectRunningRoomIntegrations,
    RoomIntegration,
    RoomIntegrationsState,
} from "../roomIntegrations";
import { signalEvents } from "../signalConnection";
import { RootState } from "../../store";
import { RoomIntegrationResponse } from "../../../api/roomIntegrationService";

const youtubeResponse: RoomIntegrationResponse = {
    roomIntegrationId: 5,
    name: "youtube",
    title: "YouTube",
    description: "Watch YouTube videos together in-room.",
    type: "video",
    icons: {
        large: "https://integrations.whereby.dev/youtube/assets/large_icon.svg",
        small: "https://integrations.whereby.dev/youtube/assets/small_icon.svg",
    },
    link: { href: "https://www.youtube.com/", text: "Visit YouTube to find your content" },
    entrypoint: "https://integrations.whereby.dev/youtube/index.4fee6293.mjs",
    webview: "https://integrations.whereby.dev/youtube/index.2ad4b051.html",
    matcher: "/https?:\\/\\/(?:youtu\\.be\\/)([\\w-]{11})/gi",
    isEmbeddable: true,
};

const googledocsResponse: RoomIntegrationResponse = {
    ...youtubeResponse,
    roomIntegrationId: 6,
    name: "googledocs",
    title: "Google Drive",
    type: "document",
    matcher: "/https:\\/\\/docs\\.google\\.com\\/.*/gi",
    isEmbeddable: false,
};

const sessionEvent = {
    roomIntegrationId: 5,
    roomIntegrationSessionId: "session-1",
    breakoutGroupId: "",
    tagName: "youtube-integration-contentframe",
    shareUrl: "https://youtu.be/dQw4w9WgXcQ",
    props: { time: 0, paused: false, videoid: "dQw4w9WgXcQ" },
    clientId: "client-1",
};

function stateWith(
    roomIntegrations: Partial<RoomIntegrationsState>,
    rest: Partial<{
        breakoutActive: boolean;
        breakoutGroup: string;
        selfId: string;
        remoteParticipants: { id: string; displayName: string }[];
        roleName: string;
    }> = {},
) {
    return {
        roomIntegrations: { ...roomIntegrationsSliceInitialState, ...roomIntegrations },
        authorization: { roleName: rest.roleName ?? "visitor" },
        breakout: { startedAt: rest.breakoutActive ? new Date() : null },
        localParticipant: { id: rest.selfId ?? "client-1", breakoutGroup: rest.breakoutGroup ?? "" },
        remoteParticipants: { remoteParticipants: rest.remoteParticipants ?? [] },
    } as unknown as RootState;
}

describe("roomIntegrations", () => {
    describe("parseRoomIntegration", () => {
        it("normalises the id to a string and parses the matcher", () => {
            const result = parseRoomIntegration(youtubeResponse) as RoomIntegration;

            expect(result.roomIntegrationId).toEqual("5");
            expect(result.matcher).toBeInstanceOf(RegExp);
            expect(result.matcher.test("https://youtu.be/dQw4w9WgXcQ")).toEqual(true);
        });

        it("strips the g flag so repeated matcher tests are stable", () => {
            const { matcher } = parseRoomIntegration(youtubeResponse) as RoomIntegration;
            const url = "https://youtu.be/dQw4w9WgXcQ";

            // With the API's `gi` flags intact, the second call would return false via lastIndex.
            expect(matcher.flags).not.toContain("g");
            expect(matcher.test(url)).toEqual(true);
            expect(matcher.test(url)).toEqual(true);
        });

        it("returns null for a malformed integration rather than throwing", () => {
            expect(parseRoomIntegration({ ...youtubeResponse, webview: "" })).toBeNull();
            expect(parseRoomIntegration({ ...youtubeResponse, matcher: "not-a-regex" })).toBeNull();
        });

        it("defaults isEmbeddable to false when absent", () => {
            const { isEmbeddable, ...withoutFlag } = youtubeResponse;
            expect(isEmbeddable).toEqual(true);
            expect(parseRoomIntegration(withoutFlag as RoomIntegrationResponse)?.isEmbeddable).toEqual(false);
        });
    });

    describe("parseRoomIntegrationSession", () => {
        it("parses a valid session", () => {
            expect(parseRoomIntegrationSession(sessionEvent)).toEqual({
                roomIntegrationSessionId: "session-1",
                roomIntegrationId: "5",
                breakoutGroupId: "",
                tagName: "youtube-integration-contentframe",
                shareUrl: "https://youtu.be/dQw4w9WgXcQ",
                props: sessionEvent.props,
                clientId: "client-1",
            });
        });

        it("rejects a non-https shareUrl", () => {
            expect(parseRoomIntegrationSession({ ...sessionEvent, shareUrl: "http://youtu.be/x" })).toBeNull();
        });

        it("rejects a tagName that is not a custom element name", () => {
            expect(parseRoomIntegrationSession({ ...sessionEvent, tagName: "div" })).toBeNull();
        });

        it("rejects nested props, which cannot become HTML attributes", () => {
            expect(
                parseRoomIntegrationSession({ ...sessionEvent, props: { metadata: { nested: true } } as never }),
            ).toBeNull();
        });
    });

    describe("reducers", () => {
        it("populates running sessions from roomJoined", () => {
            const result = roomIntegrationsSlice.reducer(
                undefined,
                signalEvents.roomJoined({ roomIntegrationSession: [sessionEvent] } as never),
            );

            expect(result.running).toHaveLength(1);
            expect(result.running[0].roomIntegrationSessionId).toEqual("session-1");
        });

        it("drops malformed sessions from roomJoined instead of failing", () => {
            const result = roomIntegrationsSlice.reducer(
                undefined,
                signalEvents.roomJoined({
                    roomIntegrationSession: [sessionEvent, { ...sessionEvent, tagName: "div" }],
                } as never),
            );

            expect(result.running).toHaveLength(1);
        });

        it("adds a session on roomIntegrationStarted", () => {
            const { roomIntegrationId, roomIntegrationSessionId, breakoutGroupId, ...state } = sessionEvent;

            const result = roomIntegrationsSlice.reducer(
                undefined,
                signalEvents.roomIntegrationStarted({
                    roomIntegrationId,
                    roomIntegrationSessionId,
                    breakoutGroupId,
                    state,
                }),
            );

            expect(result.running).toHaveLength(1);
        });

        it("does not duplicate a session the server replays", () => {
            const { roomIntegrationId, roomIntegrationSessionId, breakoutGroupId, ...state } = sessionEvent;
            const started = signalEvents.roomIntegrationStarted({
                roomIntegrationId,
                roomIntegrationSessionId,
                breakoutGroupId,
                state,
            });

            const result = roomIntegrationsSlice.reducer(
                roomIntegrationsSlice.reducer(undefined, started),
                started,
            );

            expect(result.running).toHaveLength(1);
        });

        it("removes a session on roomIntegrationStopped", () => {
            const withSession = roomIntegrationsSlice.reducer(
                undefined,
                signalEvents.roomJoined({ roomIntegrationSession: [sessionEvent] } as never),
            );

            const result = roomIntegrationsSlice.reducer(
                withSession,
                signalEvents.roomIntegrationStopped({ roomIntegrationSessionId: "session-1" }),
            );

            expect(result.running).toHaveLength(0);
        });

        it("merges partial prop patches rather than replacing the bag", () => {
            const withSession = roomIntegrationsSlice.reducer(
                undefined,
                signalEvents.roomJoined({ roomIntegrationSession: [sessionEvent] } as never),
            );

            const result = roomIntegrationsSlice.reducer(
                withSession,
                signalEvents.roomIntegrationPropsUpdated({
                    roomIntegrationSessionId: "session-1",
                    props: { paused: true },
                }),
            );

            expect(result.running[0].props).toEqual({ time: 0, paused: true, videoid: "dQw4w9WgXcQ" });
        });

        it("tracks enable and disable events", () => {
            const enabled = roomIntegrationsSlice.reducer(
                undefined,
                signalEvents.roomIntegrationEnabled({ roomIntegrationId: 5 }),
            );
            expect(enabled.enabled).toEqual(["5"]);

            const disabled = roomIntegrationsSlice.reducer(
                enabled,
                signalEvents.roomIntegrationDisabled({ roomIntegrationId: 5 }),
            );
            expect(disabled.enabled).toEqual([]);
        });
    });

    describe("selectors", () => {
        const youtube = parseRoomIntegration(youtubeResponse) as RoomIntegration;
        const googledocs = parseRoomIntegration(googledocsResponse) as RoomIntegration;

        it("selectEnabledRoomIntegrations includes non-embeddable integrations", () => {
            const state = stateWith({ available: [youtube, googledocs], enabled: ["5", "6"] });
            expect(selectEnabledRoomIntegrations(state).map((i) => i.name)).toEqual(["youtube", "googledocs"]);
        });

        it("selectEmbeddableRoomIntegrations excludes non-embeddable integrations", () => {
            const state = stateWith({ available: [youtube, googledocs], enabled: ["5", "6"] });
            expect(selectEmbeddableRoomIntegrations(state).map((i) => i.name)).toEqual(["youtube"]);
        });

        it("selectRunningRoomIntegrations joins metadata and resolves the presenter", () => {
            const session = parseRoomIntegrationSession(sessionEvent)!;
            const state = stateWith(
                { available: [youtube], enabled: ["5"], running: [session] },
                { selfId: "client-1" },
            );

            const [running] = selectRunningRoomIntegrations(state);
            expect(running.integration.name).toEqual("youtube");
            expect(running.isPresenter).toEqual(true);
            expect(running.presenterDisplayName).toBeNull();
        });

        it("resolves the presenter display name for a remote presenter", () => {
            const session = parseRoomIntegrationSession(sessionEvent)!;
            const state = stateWith(
                { available: [youtube], enabled: ["5"], running: [session] },
                { selfId: "client-2", remoteParticipants: [{ id: "client-1", displayName: "Ada" }] },
            );

            const [running] = selectRunningRoomIntegrations(state);
            expect(running.isPresenter).toEqual(false);
            expect(running.presenterDisplayName).toEqual("Ada");
        });

        it("omits sessions whose integration is not in the catalog", () => {
            const session = parseRoomIntegrationSession(sessionEvent)!;
            const state = stateWith({ available: [], enabled: [], running: [session] });
            expect(selectRunningRoomIntegrations(state)).toEqual([]);
        });

        it("omits sessions belonging to another breakout group", () => {
            const session = parseRoomIntegrationSession({ ...sessionEvent, breakoutGroupId: "a" })!;
            const state = stateWith(
                { available: [youtube], enabled: ["5"], running: [session] },
                { breakoutActive: true, breakoutGroup: "b" },
            );

            expect(selectRunningRoomIntegrations(state)).toEqual([]);
        });

        it("includes sessions belonging to the current breakout group", () => {
            const session = parseRoomIntegrationSession({ ...sessionEvent, breakoutGroupId: "b" })!;
            const state = stateWith(
                { available: [youtube], enabled: ["5"], running: [session] },
                { breakoutActive: true, breakoutGroup: "b" },
            );

            expect(selectRunningRoomIntegrations(state)).toHaveLength(1);
        });

        describe("canStop", () => {
            const session = parseRoomIntegrationSession(sessionEvent)!;
            const running = { available: [youtube], enabled: ["5"], running: [session] };

            it("is true for the presenter", () => {
                const state = stateWith(running, { selfId: "client-1", roleName: "visitor" });
                expect(selectRunningRoomIntegrations(state)[0].canStop).toEqual(true);
            });

            it("is true for a host who did not start it", () => {
                const state = stateWith(running, { selfId: "client-2", roleName: "host" });
                expect(selectRunningRoomIntegrations(state)[0].canStop).toEqual(true);
            });

            it("is false for a viewer who did not start it", () => {
                const state = stateWith(running, { selfId: "client-2", roleName: "visitor" });
                expect(selectRunningRoomIntegrations(state)[0].canStop).toEqual(false);
            });
        });

        describe("doStopRoomIntegration", () => {
            const session = parseRoomIntegrationSession(sessionEvent)!;
            const running = { available: [youtube], enabled: ["5"], running: [session] };

            function run(rest: { selfId: string; roleName: string }) {
                const emit = jest.fn();
                const state = {
                    ...stateWith(running, rest),
                    roomConnection: { status: "connected" },
                    signalConnection: { socket: { emit } },
                } as unknown as RootState;
                const dispatch = jest.fn();

                doStopRoomIntegration({ roomIntegrationSessionId: "session-1" })(dispatch, () => state, {} as never);

                return { emit, dispatch };
            }

            it("stops the session for the presenter", () => {
                const { emit } = run({ selfId: "client-1", roleName: "visitor" });
                expect(emit).toHaveBeenCalledWith("stop_room_integration", {
                    roomIntegrationSessionId: "session-1",
                    intent: "stop",
                });
            });

            it("stops the session for a host who did not start it", () => {
                const { emit } = run({ selfId: "client-2", roleName: "host" });
                expect(emit).toHaveBeenCalled();
            });

            it("refuses with a readable error for a viewer, without emitting", () => {
                jest.spyOn(console, "warn").mockImplementation(() => {});
                const { emit, dispatch } = run({ selfId: "client-2", roleName: "visitor" });

                expect(emit).not.toHaveBeenCalled();
                expect(dispatch).toHaveBeenCalledWith(
                    setRoomIntegrationsError({ error: STOP_ROOM_INTEGRATION_NOT_ALLOWED_ERROR }),
                );
                (console.warn as jest.Mock).mockRestore();
            });
        });

        it("selectRoomIntegrationForUrl only matches embeddable integrations", () => {
            const state = stateWith({ available: [youtube, googledocs], enabled: ["5", "6"] });
            const findForUrl = selectRoomIntegrationForUrl(state);

            expect(findForUrl("https://youtu.be/dQw4w9WgXcQ")?.name).toEqual("youtube");
            expect(findForUrl("https://docs.google.com/document/d/abc/edit")).toBeNull();
            expect(findForUrl("https://example.com")).toBeNull();
        });
    });
});
