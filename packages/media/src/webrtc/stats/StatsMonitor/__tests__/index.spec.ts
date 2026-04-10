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
        baseState = {
            currentMonitor: null,
            getClients: jest.fn(),
            lastUpdateTime: 0,
            statsByView: {},
            subscriptions: [],
            numFailedStatsReports: 0,
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
