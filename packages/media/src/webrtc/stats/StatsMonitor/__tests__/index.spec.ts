import { StatsMonitorOptions, StatsMonitorState, subscribeStats } from "..";
import { collectStats } from "../collectStats";
import { startCpuObserver } from "../cpuObserver";

jest.mock("../collectStats");
jest.mock("../cpuObserver");

jest.useFakeTimers();

describe("subscribeStats", () => {
    let options: StatsMonitorOptions;
    let baseState: StatsMonitorState;

    beforeEach(() => {
        // monitors started by earlier tests would otherwise keep running on the shared fake timers
        jest.clearAllTimers();
        jest.clearAllMocks();
        baseState = {
            currentMonitor: null,
            getClients: jest.fn(),
            lastUpdateTime: 0,
            statsByView: {},
            subscriptions: [],
            numFailedStatsReports: 0,
            renderedDimensionsByTrack: {},
        };
        options = { interval: 2000, logger: { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() } };
    });

    describe("with current monitor", () => {
        let currentMonitor: StatsMonitorState["currentMonitor"];

        beforeEach(() => {
            currentMonitor = { getUpdatedStats: jest.fn(), stop: jest.fn() };
        });

        it("should store new subscription", () => {
            const state = { ...baseState, currentMonitor };
            const subscription = { onUpdatedStats: jest.fn() };

            subscribeStats(subscription, options, state);

            expect(state.subscriptions).toEqual([subscription]);
        });

        it("should return stop function which removes subscription", () => {
            const state = { ...baseState, currentMonitor };
            const subscription = { onUpdatedStats: jest.fn() };

            subscribeStats(subscription, options, state).stop();

            expect(state.subscriptions).toEqual([]);
            expect(currentMonitor?.stop).toHaveBeenCalled();
            expect(state.currentMonitor).toBeNull();
        });
    });

    describe("when no current monitor exists", () => {
        it("should start cpu observer", () => {
            const state = { ...baseState };
            const subscription = { onUpdatedStats: jest.fn() };

            subscribeStats(subscription, options, state);

            expect(startCpuObserver).toHaveBeenCalled();
        });

        it("should schedule stats collection", () => {
            const state = { ...baseState };
            const subscription = { onUpdatedStats: jest.fn() };

            subscribeStats(subscription, options, state);
            jest.advanceTimersByTime(options.interval);

            expect(collectStats).toHaveBeenCalled();
        });

        it("should set monitor with getUpdatedStats and stop functions", () => {
            const state = { ...baseState, currentMonitor: null };
            const subscription = { onUpdatedStats: jest.fn() };

            subscribeStats(subscription, options, state);

            expect(state.currentMonitor).toMatchObject({
                getUpdatedStats: expect.any(Function),
                stop: expect.any(Function),
            });
        });

        it("should keep collecting stats every interval", async () => {
            (collectStats as jest.Mock).mockResolvedValue(undefined);
            const state = { ...baseState };

            subscribeStats({ onUpdatedStats: jest.fn() }, options, state);
            await jest.advanceTimersByTimeAsync(options.interval * 3);

            expect(collectStats).toHaveBeenCalledTimes(3);
        });

        it("should keep collecting stats after a run failed unexpectedly", async () => {
            (collectStats as jest.Mock).mockRejectedValueOnce(new Error("unexpected")).mockResolvedValue(undefined);
            const state = { ...baseState };

            subscribeStats({ onUpdatedStats: jest.fn() }, options, state);
            await jest.advanceTimersByTimeAsync(options.interval * 3);

            expect(collectStats).toHaveBeenCalledTimes(3);
        });

        it("should never collect stats when stopped before the first run", async () => {
            const state = { ...baseState };

            subscribeStats({ onUpdatedStats: jest.fn() }, options, state).stop();
            await jest.advanceTimersByTimeAsync(options.interval * 3);

            expect(collectStats).not.toHaveBeenCalled();
        });

        it("should not schedule another run when stopped while stats are being collected", async () => {
            let finishCollecting: (() => void) | undefined;
            (collectStats as jest.Mock).mockImplementationOnce(
                () => new Promise<void>((resolve) => (finishCollecting = resolve)),
            );
            const state = { ...baseState };

            const subscription = subscribeStats({ onUpdatedStats: jest.fn() }, options, state);
            await jest.advanceTimersByTimeAsync(options.interval);
            expect(collectStats).toHaveBeenCalledTimes(1);

            subscription.stop();
            finishCollecting!();
            await jest.advanceTimersByTimeAsync(options.interval * 3);

            expect(collectStats).toHaveBeenCalledTimes(1);
        });

        it("should stop cpu monitor on stop", () => {
            const state = { ...baseState, currentMonitor: null };
            const stop = jest.fn();
            (startCpuObserver as jest.Mock).mockReturnValueOnce({ stop });
            const subscription = { onUpdatedStats: jest.fn() };

            subscribeStats(subscription, options, state).stop();

            expect(stop).toHaveBeenCalled();
        });
    });
});
