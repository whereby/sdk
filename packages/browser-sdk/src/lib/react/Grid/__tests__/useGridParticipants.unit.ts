import { calculateSubgridViews } from "../useGridParticipants";

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
});
