import * as React from "react";
import { renderHook } from "@testing-library/react";

import { ClientView, GridState, WherebyClient } from "@whereby.com/core";
import { WherebyContext } from "../../Provider";
import { calculateSubgridViews, useGridParticipants } from "../useGridParticipants";

function makeFakeGridClient(clientViews: ClientView[]) {
    const subscribers = new Set<() => void>();

    return {
        getState: (): GridState => ({
            allClientViews: clientViews,
            spotlightedParticipants: [],
            numParticipants: clientViews.length,
        }),
        subscribeClientViews: (cb: (views: ClientView[]) => void) => {
            const notify = () => cb(clientViews);
            subscribers.add(notify);
            return () => subscribers.delete(notify);
        },
        subscribeSpotlightedParticipants: () => () => {},
        subscribeNumberOfClientViews: () => () => {},
    };
}

function renderGridParticipants(clientViews: ClientView[]) {
    const grid = makeFakeGridClient(clientViews);
    const client = { getGrid: () => grid } as unknown as WherebyClient;

    return renderHook(() => useGridParticipants(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
            React.createElement(WherebyContext.Provider, { value: client }, children),
    });
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
});
