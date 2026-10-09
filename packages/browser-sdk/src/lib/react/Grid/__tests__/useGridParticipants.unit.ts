import * as React from "react";
import { renderHook } from "@testing-library/react";

import { ClientView, GridState, RoomIntegrationSessionView, WherebyClient } from "@whereby.com/core";
import { WherebyContext } from "../../Provider";
import { calculateSubgridViews, useGridParticipants } from "../useGridParticipants";

interface FakeGridState {
    spotlightedParticipants?: ClientView[];
    runningRoomIntegrations?: RoomIntegrationSessionView[];
}

function makeFakeGridClient(clientViews: ClientView[], extra: FakeGridState = {}) {
    const subscribers = new Set<() => void>();

    return {
        getState: (): GridState => ({
            allClientViews: clientViews,
            spotlightedParticipants: extra.spotlightedParticipants || [],
            runningRoomIntegrations: extra.runningRoomIntegrations || [],
            numParticipants: clientViews.length,
        }),
        subscribeClientViews: (cb: (views: ClientView[]) => void) => {
            const notify = () => cb(clientViews);
            subscribers.add(notify);
            return () => subscribers.delete(notify);
        },
        subscribeSpotlightedParticipants: () => () => {},
        subscribeNumberOfClientViews: () => () => {},
        subscribeRunningRoomIntegrations: () => () => {},
    };
}

function renderGridParticipants(
    clientViews: ClientView[],
    extra: FakeGridState = {},
    props: Parameters<typeof useGridParticipants>[0] = {},
) {
    const grid = makeFakeGridClient(clientViews, extra);
    const client = { getGrid: () => grid } as unknown as WherebyClient;

    return renderHook(() => useGridParticipants(props), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
            React.createElement(WherebyContext.Provider, { value: client }, children),
    });
}

const withIntegrations = { includeIntegrations: true };

function makeSession(roomIntegrationSessionId: string): RoomIntegrationSessionView {
    return { roomIntegrationSessionId } as RoomIntegrationSessionView;
}

describe("useGridParticipants", () => {
    const client1 = { id: "some-stream-id-1" };
    const client2 = { id: "some-stream-id-2" };
    const videoClient = { id: "video-on-stream-id", isVideoEnabled: true };
    const audioClient = { id: "video-off-stream-id", isVideoEnabled: false };
    const presentationClient = {
        id: "presentation-stream-id",
        isPresentation: true,
        isVideoEnabled: true,
    };
    const videoLocalClient = {
        id: "some-stream-id",
        isLocalClient: true,
        isVideoEnabled: true,
        isAudioEnabled: true,
    };
    const mutedVideoClient = {
        id: "muted-video-stream-id",
        isLocalClient: true,
        isVideoEnabled: true,
        isAudioEnabled: false,
    };

    describe("calculateSubgridViews", () => {
        it.each`
            allClientViews                                                           | shouldShowSubgrid | activeVideosSubgridTrigger | result
            ${[videoLocalClient, client1, client2]}                                  | ${false}          | ${12}                      | ${[]}
            ${[videoLocalClient, audioClient, videoClient, presentationClient]}      | ${true}           | ${12}                      | ${[audioClient]}
            ${[videoLocalClient, audioClient, videoClient, presentationClient]}      | ${true}           | ${12}                      | ${[audioClient]}
            ${[videoLocalClient, audioClient, videoClient, presentationClient]}      | ${true}           | ${12}                      | ${[audioClient]}
            ${[videoLocalClient, audioClient, videoClient, presentationClient]}      | ${true}           | ${12}                      | ${[audioClient]}
            ${[videoLocalClient, audioClient, videoClient, presentationClient]}      | ${true}           | ${12}                      | ${[audioClient]}
            ${[videoLocalClient, audioClient, videoClient, presentationClient]}      | ${true}           | ${12}                      | ${[audioClient]}
            ${[videoLocalClient, videoClient, presentationClient]}                   | ${true}           | ${12}                      | ${[]}
            ${[videoLocalClient, audioClient, videoClient, presentationClient]}      | ${true}           | ${12}                      | ${[audioClient]}
            ${[videoLocalClient, audioClient, mutedVideoClient, presentationClient]} | ${true}           | ${12}                      | ${[audioClient]}
            ${[videoLocalClient, mutedVideoClient, presentationClient]}              | ${true}           | ${12}                      | ${[]}
        `(
            `expected result:$result, when
            allClientViews:$allClientViews,
            shouldShowSubgrid:$shouldShowSubgrid,
            activeVideosSubgridTrigger:$activeVideosSubgridTrigger
        `,
            ({ allClientViews, shouldShowSubgrid, activeVideosSubgridTrigger, result }) => {
                expect(
                    calculateSubgridViews({
                        clientViews: allClientViews,
                        shouldShowSubgrid,
                        activeVideosSubgridTrigger,
                        spotlightedParticipants: [],
                    }),
                ).toEqual(result);
            },
        );
    });

    describe("mounting after the state has settled", () => {
        it("returns the client views already present when the hook mounts", () => {
            const { result } = renderGridParticipants([videoLocalClient as ClientView]);

            expect(result.current.clientViewsInGrid).toEqual([videoLocalClient]);
        });

        it("returns an empty grid when there are no client views", () => {
            const { result } = renderGridParticipants([]);

            expect(result.current.clientViewsInGrid).toEqual([]);
        });
    });

    describe("a running integration on the stage", () => {
        const session = makeSession("session-1");
        const spotlighted = presentationClient as ClientView;

        it("puts the running integration on the stage", () => {
            const { result } = renderGridParticipants(
                [videoLocalClient as ClientView],
                { runningRoomIntegrations: [session] },
                withIntegrations,
            );

            expect(result.current.integrationsInPresentationGrid).toEqual([session]);
        });

        it("displaces spotlighted participants off the stage", () => {
            const { result } = renderGridParticipants(
                [videoLocalClient as ClientView, spotlighted],
                { spotlightedParticipants: [spotlighted], runningRoomIntegrations: [session] },
                withIntegrations,
            );

            expect(result.current.clientViewsInPresentationGrid).toEqual([]);
            expect(result.current.clientViewsInGrid).toContain(spotlighted);
        });

        it("spotlights hold the stage again once the integration stops", () => {
            const { result } = renderGridParticipants(
                [videoLocalClient as ClientView, spotlighted],
                { spotlightedParticipants: [spotlighted] },
                withIntegrations,
            );

            expect(result.current.clientViewsInPresentationGrid).toEqual([spotlighted]);
        });

        it("keeps only the first integration on the stage, sending the rest to the subgrid", () => {
            const second = makeSession("session-2");
            const { result } = renderGridParticipants(
                [videoLocalClient as ClientView],
                { runningRoomIntegrations: [session, second] },
                withIntegrations,
            );

            expect(result.current.integrationsInPresentationGrid).toEqual([session]);
            expect(result.current.integrationsInSubgrid).toEqual([second]);
        });

        it("shrinks muted participants into the subgrid as a spotlight would", () => {
            const clients = [videoLocalClient, audioClient, mutedVideoClient] as ClientView[];

            const withIntegration = renderGridParticipants(
                clients,
                { runningRoomIntegrations: [session] },
                withIntegrations,
            );
            expect(withIntegration.result.current.clientViewsInSubgrid).toEqual([mutedVideoClient, audioClient]);

            const withoutIntegration = renderGridParticipants(clients, {}, withIntegrations);
            expect(withoutIntegration.result.current.clientViewsInSubgrid).toEqual([audioClient]);
        });
    });

    // A grid with no way to render an integration cell has to lay out as it did before integrations
    // existed, or a share from the Whereby app would take the stage and leave it empty.
    describe("with integrations not included", () => {
        const session = makeSession("session-1");
        const second = makeSession("session-2");
        const spotlighted = presentationClient as ClientView;
        const clients = [videoLocalClient, audioClient, mutedVideoClient, spotlighted] as ClientView[];

        function layoutOf(result: { current: ReturnType<typeof useGridParticipants> }) {
            const {
                clientViewsInGrid,
                clientViewsInPresentationGrid,
                clientViewsInSubgrid,
                integrationsInPresentationGrid,
                integrationsInSubgrid,
                integrationsHidden,
            } = result.current;

            return {
                clientViewsInGrid,
                clientViewsInPresentationGrid,
                clientViewsInSubgrid,
                integrationsInPresentationGrid,
                integrationsInSubgrid,
                integrationsHidden,
            };
        }

        it("ignores running integrations by default", () => {
            const { result } = renderGridParticipants(clients, {
                spotlightedParticipants: [spotlighted],
                runningRoomIntegrations: [session, second],
            });

            expect(result.current.integrationsInPresentationGrid).toEqual([]);
            expect(result.current.integrationsInSubgrid).toEqual([]);
            expect(result.current.integrationsHidden).toEqual([]);
        });

        it("keeps spotlighted participants on the stage", () => {
            const { result } = renderGridParticipants(clients, {
                spotlightedParticipants: [spotlighted],
                runningRoomIntegrations: [session],
            });

            expect(result.current.clientViewsInPresentationGrid).toEqual([spotlighted]);
            expect(result.current.clientViewsInGrid).not.toContain(spotlighted);
        });

        it.each`
            enableSubgrid | maximizedCellId
            ${true}       | ${undefined}
            ${false}      | ${undefined}
            ${true}       | ${videoLocalClient.id}
            ${false}      | ${videoLocalClient.id}
        `(
            "lays out as if nothing were running (enableSubgrid: $enableSubgrid, maximizedCellId: $maximizedCellId)",
            ({ enableSubgrid, maximizedCellId }) => {
                const props = { enableSubgrid, maximizedCellId };

                const withRunning = renderGridParticipants(
                    clients,
                    { spotlightedParticipants: [spotlighted], runningRoomIntegrations: [session, second] },
                    props,
                );
                const withoutRunning = renderGridParticipants(
                    clients,
                    { spotlightedParticipants: [spotlighted] },
                    props,
                );

                expect(layoutOf(withRunning.result)).toEqual(layoutOf(withoutRunning.result));
            },
        );
    });

    describe("maximizing", () => {
        const session = makeSession("session-1");

        it("takes the stage back from a running integration", () => {
            const { result } = renderGridParticipants(
                [videoLocalClient as ClientView],
                { runningRoomIntegrations: [session] },
                { ...withIntegrations, maximizedCellId: videoLocalClient.id },
            );

            expect(result.current.integrationsInPresentationGrid).toEqual([]);
            expect(result.current.clientViewsInPresentationGrid).toEqual([videoLocalClient]);
        });

        // unmounting the frame would stop playback and restart the video from the beginning, so a
        // displaced integration has to stay mounted somewhere
        it("keeps the displaced integration alive offscreen", () => {
            const { result } = renderGridParticipants(
                [videoLocalClient as ClientView],
                { runningRoomIntegrations: [session] },
                { ...withIntegrations, maximizedCellId: videoLocalClient.id, enableSubgrid: false },
            );

            expect(result.current.integrationsHidden).toEqual([session]);
        });

        it("resolves the maximized participant from the current views, not a snapshot", () => {
            const { result } = renderGridParticipants(
                [videoLocalClient as ClientView, client2 as ClientView],
                {},
                {
                    maximizedCellId: videoLocalClient.id,
                },
            );

            expect(result.current.maximizedClientView).toBe(videoLocalClient);
            expect(result.current.clientViewsInPresentationGrid).toEqual([videoLocalClient]);
            expect(result.current.clientViewsInGrid).not.toContain(videoLocalClient);
        });

        it("maximizes nothing when the id no longer matches a participant", () => {
            const { result } = renderGridParticipants(
                [videoLocalClient as ClientView],
                {},
                {
                    maximizedCellId: "someone-who-left",
                },
            );

            expect(result.current.maximizedClientView).toBeNull();
            expect(result.current.clientViewsInPresentationGrid).toEqual([]);
        });
    });
});
