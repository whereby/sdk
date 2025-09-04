import {
    badNetworkIssueDetector,
    dryTrackIssueDetector,
    noTrackIssueDetector,
    IssueCheckData,
    noTrackStatsIssueDetector,
} from "../issueDetectors";
import { SsrcStats, StatsClient, TrackStats, ViewStats } from "../../types";
import { mockSsrcStats } from "../../../../../tests/webrtc/webRtcHelpers";

/**
 * By default, client media is enabled for all tests.
 * Test cases for disabled media are generated automatically
 * by `buildEnabledTestCases()` helper function.
 */
function makeStatsClient(args?: Partial<StatsClient>): StatsClient {
    return {
        isLocalClient: true,
        isAudioOnlyModeEnabled: false,
        audio: { enabled: true },
        video: { enabled: true },
        clientId: "local",
        id: "local",
        isPresentation: false,
        ...args,
    };
}

function makeCheckData(args?: Partial<IssueCheckData>): IssueCheckData {
    return {
        client: makeStatsClient(),
        clients: [makeStatsClient(), makeStatsClient()],
        kind: "audio",
        track: undefined,
        trackStats: {} as TrackStats,
        stats: {} as ViewStats,
        hasLiveTrack: true,
        ssrc0: {} as SsrcStats,
        ssrcs: {} as SsrcStats[],
        issues: {},
        metrics: {},
        ...args,
    };
}

function buildEnabledTestCases(
    testCases: (Partial<IssueCheckData> & { expected: boolean })[],
): (IssueCheckData & { expected: boolean })[] {
    const cases = testCases.map((t) => ({
        ...makeCheckData(t),
        expected: t.expected,
    }));

    const mediaDisabledCases = cases
        .filter((t) => t.expected === true)
        .map((t) => ({
            ...makeCheckData({
                ...t,
                client: makeStatsClient({ audio: { enabled: false }, video: { enabled: false } }),
            }),
            expected: false,
        }));
    return [...cases, ...mediaDisabledCases];
}

describe("badNetworkIssueDetector", () => {
    describe("enabled", () => {
        const TEST_CASES = buildEnabledTestCases([
            { hasLiveTrack: false, ssrcs: [], expected: false },
            { hasLiveTrack: true, ssrcs: [], expected: false },
            { hasLiveTrack: false, ssrcs: [mockSsrcStats()], expected: false },
            { hasLiveTrack: true, ssrcs: [mockSsrcStats()], expected: true },
        ]);
        it.each(TEST_CASES)(
            "expected $expected when hasLiveTrack:$hasLiveTrack, ssrcs:$ssrcs",
            ({ expected, ...checkData }) => {
                expect(badNetworkIssueDetector.enabled(checkData)).toEqual(expected);
            },
        );
    });

    describe("check", () => {
        const client = makeStatsClient({ isLocalClient: true });

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
                const checkData = makeCheckData({
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
        const TEST_CASES = buildEnabledTestCases([
            { hasLiveTrack: false, ssrcs: undefined, expected: false },
            { hasLiveTrack: true, ssrcs: undefined, expected: false },
            { hasLiveTrack: false, ssrcs: [mockSsrcStats()], expected: false },
            { hasLiveTrack: true, ssrcs: [mockSsrcStats()], expected: true },
        ]);
        it.each(TEST_CASES)(
            "expected $expected when hasLiveTrack:$hasLiveTrack, ssrcs:$ssrcs",
            ({ expected, ...checkData }) => {
                expect(dryTrackIssueDetector.enabled(checkData)).toEqual(expected);
            },
        );
    });

    describe("check", () => {
        describe("local client", () => {
            const client = makeStatsClient({ isLocalClient: true });

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
                    const checkData = makeCheckData({
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
            const client = makeStatsClient({ isLocalClient: true });
            it.each`
                client    | clients                                                              | kind       | track        | expected
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${{}}        | ${false}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${undefined} | ${true}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"video"} | ${undefined} | ${true}
            `(
                "expected $expected when client:$client, clients:$clients, kind:$kind, track:$track",
                ({ client, clients, kind, track, expected }) => {
                    const checkData = makeCheckData({
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
            const client = makeStatsClient({ isLocalClient: false });
            it.each`
                client    | clients                                                              | kind       | track        | expected
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${{}}        | ${false}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${undefined} | ${true}
                ${client} | ${[client, { isLocalClient: true, isAudioOnlyModeEnabled: true }]}   | ${"video"} | ${undefined} | ${false}
            `(
                "expected $expected when client:$client, clients:$clients, kind:$kind, track:$track",
                ({ client, clients, kind, track, expected }) => {
                    const checkData = makeCheckData({
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
        const TEST_CASES = buildEnabledTestCases([
            { hasLiveTrack: false, expected: false },
            { hasLiveTrack: true, expected: true },
        ]);
        it.each(TEST_CASES)("expected $expected when hasLiveTrack:$hasLiveTrack", ({ expected, ...checkData }) => {
            expect(noTrackStatsIssueDetector.enabled(checkData)).toEqual(expected);
        });
    });

    describe("check", () => {
        describe("local client", () => {
            const client = makeStatsClient({ isLocalClient: true });
            it.each`
                client    | clients                                                              | kind       | ssrcs   | expected
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${[{}]} | ${false}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${[]}   | ${true}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"video"} | ${[]}   | ${true}
            `(
                "expected $expected when client:$client, clients:$clients, kind:$kind, ssrcs:$ssrcs",
                ({ client, clients, kind, ssrcs, expected }) => {
                    const checkData = makeCheckData({
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
            const client = makeStatsClient({ isLocalClient: false });
            it.each`
                client    | clients                                                              | kind       | ssrcs   | expected
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${[{}]} | ${false}
                ${client} | ${[client, { isLocalClient: false, isAudioOnlyModeEnabled: false }]} | ${"audio"} | ${[]}   | ${true}
                ${client} | ${[client, { isLocalClient: true, isAudioOnlyModeEnabled: true }]}   | ${"video"} | ${[]}   | ${false}
            `(
                "expected $expected when client:$client, clients:$clients, kind:$kind, ssrcs:$ssrcs",
                ({ client, clients, kind, ssrcs, expected }) => {
                    const checkData = makeCheckData({
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
