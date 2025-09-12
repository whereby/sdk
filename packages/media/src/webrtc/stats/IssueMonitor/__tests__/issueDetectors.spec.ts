import {
    badNetworkIssueDetector,
    dryTrackIssueDetector,
    noTrackIssueDetector,
    noTrackStatsIssueDetector,
} from "../issueDetectors";
import { mockCheckData, mockStatsClient } from "../../../../../tests/webrtc/webRtcHelpers";

describe("badNetworkIssueDetector", () => {
    describe("enabled", () => {
        it.each`
            hasLiveTrack | ssrcs   | expected
            ${false}     | ${[]}   | ${false}
            ${true}      | ${[]}   | ${false}
            ${false}     | ${[{}]} | ${false}
            ${true}      | ${[{}]} | ${true}
        `("expected $expected when hasLiveTrack:$hasLiveTrack, ssrcs:$ssrcs", ({ hasLiveTrack, ssrcs, expected }) => {
            const checkData = mockCheckData({
                hasLiveTrack,
                ssrcs,
            });

            expect(badNetworkIssueDetector.enabled(checkData)).toEqual(expected);
        });
    });

    describe("check", () => {
        const client = mockStatsClient({ isLocalClient: true });

        it.each`
            client    | clients                                                              | kind       | ssrcs                                     | expected
            ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${[{ bitrate: 222 }]}                     | ${false}
            ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${[{ bitrate: 0 }]}                       | ${true}
            ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"video"} | ${[{ bitrate: 0 }]}                       | ${true}
            ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: true }]}  | ${"video"} | ${[{ bitrate: 0 }]}                       | ${false}
            ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"video"} | ${[{ bitrate: 123, lossRatio: 0.04 }]}    | ${true}
            ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"video"} | ${[{ bitrate: 123, fractionLost: 0.04 }]} | ${true}
        `(
            "expected $expected when client:$client, clients:$clients, kind:$kind, ssrcs:$ssrcs",
            ({ client, clients, kind, ssrcs, expected }) => {
                const checkData = mockCheckData({
                    client,
                    clients,
                    kind,
                    ssrcs,
                });

                expect(badNetworkIssueDetector.check(checkData)).toEqual(expected);
            },
        );
    });
});

describe("dryTrackIssueDetector", () => {
    describe("enabled", () => {
        it.each`
            hasLiveTrack | ssrcs   | expected
            ${false}     | ${null} | ${false}
            ${true}      | ${null} | ${false}
            ${false}     | ${{}}   | ${false}
            ${true}      | ${{}}   | ${true}
        `("expected $expected when hasLiveTrack:$hasLiveTrack, ssrcs:$ssrcs", ({ hasLiveTrack, ssrcs, expected }) => {
            const checkData = mockCheckData({
                hasLiveTrack,
                ssrcs,
            });

            expect(dryTrackIssueDetector.enabled(checkData)).toEqual(expected);
        });
    });

    describe("check", () => {
        describe("local client", () => {
            const client = mockStatsClient({ isLocalClient: true });

            it.each`
                client    | clients                                                              | ssrcs                                 | expected
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${[{ bitrate: 222 }]}                 | ${false}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${[{ bitrate: 0 }]}                   | ${true}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${[{ bitrate: 222 }, { bitrate: 0 }]} | ${false}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${[{ bitrate: 0 }, { bitrate: 0 }]}   | ${true}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: true }]}  | ${[{ bitrate: 0 }, { bitrate: 0 }]}   | ${false}
            `(
                "expected $expected when client:$client, clients:$clients, ssrcs:$ssrcs",
                ({ client, clients, ssrcs, expected }) => {
                    const checkData = mockCheckData({
                        client,
                        clients,
                        ssrcs,
                    });

                    expect(dryTrackIssueDetector.check(checkData)).toEqual(expected);
                },
            );
        });
    });
});

describe("noTrackIssueDetector", () => {
    describe("check", () => {
        describe("local client", () => {
            const client = mockStatsClient({ isLocalClient: true });
            it.each`
                client    | clients                                                              | kind       | track        | expected
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${{}}        | ${false}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${undefined} | ${true}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"video"} | ${undefined} | ${true}
            `(
                "expected $expected when client:$client, clients:$clients, kind:$kind, track:$track",
                ({ client, clients, kind, track, expected }) => {
                    const checkData = mockCheckData({
                        client,
                        clients,
                        kind,
                        track,
                    });

                    expect(noTrackIssueDetector.check(checkData)).toEqual(expected);
                },
            );
        });

        describe("remote client", () => {
            const client = mockStatsClient({ isLocalClient: false });
            it.each`
                client    | clients                                                              | kind       | track        | expected
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${{}}        | ${false}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${undefined} | ${true}
                ${client} | ${[client, { isLocalClient: true, isAudioOnlyModeEnabled: true }]}   | ${"video"} | ${undefined} | ${false}
            `(
                "expected $expected when client:$client, clients:$clients, kind:$kind, track:$track",
                ({ client, clients, kind, track, expected }) => {
                    const checkData = mockCheckData({
                        client,
                        clients,
                        kind,
                        track,
                    });

                    expect(noTrackIssueDetector.check(checkData)).toEqual(expected);
                },
            );
        });
    });
});

describe("noTrackStatsIssueDetector", () => {
    describe("enabled", () => {
        it.each`
            hasLiveTrack | expected
            ${false}     | ${false}
            ${true}      | ${true}
        `("expected $expected when hasLiveTrack:$hasLiveTrack", ({ hasLiveTrack, expected }) => {
            const checkData = mockCheckData({
                hasLiveTrack,
            });

            expect(noTrackStatsIssueDetector.enabled(checkData)).toEqual(expected);
        });
    });

    describe("check", () => {
        describe("local client", () => {
            const client = mockStatsClient({ isLocalClient: true });
            it.each`
                client    | clients                                                              | kind       | ssrcs   | expected
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${[{}]} | ${false}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${[]}   | ${true}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"video"} | ${[]}   | ${true}
            `(
                "expected $expected when client:$client, clients:$clients, kind:$kind, ssrcs:$ssrcs",
                ({ client, clients, kind, ssrcs, expected }) => {
                    const checkData = mockCheckData({
                        client,
                        clients,
                        kind,
                        ssrcs,
                    });

                    expect(noTrackStatsIssueDetector.check(checkData)).toEqual(expected);
                },
            );
        });

        describe("remote client", () => {
            const client = mockStatsClient({ isLocalClient: false });
            it.each`
                client    | clients                                                              | kind       | ssrcs   | expected
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${[{}]} | ${false}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${[]}   | ${true}
                ${client} | ${[client, { isLocalClient: true, isAudioOnlyModeEnabled: true }]}   | ${"video"} | ${[]}   | ${false}
            `(
                "expected $expected when client:$client, clients:$clients, kind:$kind, ssrcs:$ssrcs",
                ({ client, clients, kind, ssrcs, expected }) => {
                    const checkData = mockCheckData({
                        client,
                        clients,
                        kind,
                        ssrcs,
                    });

                    expect(noTrackStatsIssueDetector.check(checkData)).toEqual(expected);
                },
            );
        });
    });
});
