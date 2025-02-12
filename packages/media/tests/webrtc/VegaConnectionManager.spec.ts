import { convertToProperHostList, createVegaConnectionManager } from "../../src/webrtc/VegaConnectionManager";
import VegaConnection from "../../src/webrtc/VegaConnection";
import { EventEmitter } from "events";

describe("convertToProperHostList", () => {
    it("converts a serialized string of hosts to an array of hosts", () => {
        expect(convertToProperHostList("host1:23,dc_a|host2,dc_b|sfu.bhost.com:999")).toStrictEqual([
            { host: "host1:23", dc: "" },
            { host: "host2", dc: "dc_a" },
            { host: "sfu.bhost.com:999", dc: "dc_b" },
        ]);
    });

    it("makes sure DCs are initialized to blank string if not provided", () => {
        expect(
            convertToProperHostList([
                { host: "host1", dc: "a" },
                { host: "host2" },
                { host: "host3" },
                { host: "host4", dc: "" },
            ]),
        ).toStrictEqual([
            { host: "host1", dc: "a" },
            { host: "host2", dc: "" },
            { host: "host3", dc: "" },
            { host: "host4", dc: "" },
        ]);
    });
});

// creates mock VegaConnection with events emitted at timings specified in url
// example: 'host1 open:100 close:400' will fire open 100ms after construction, and close 400ms after construction
jest.mock("../../src/webrtc/VegaConnection.ts", () => {
    return jest.fn().mockImplementation((url) => {
        const emitter = new EventEmitter();
        url.replace(/(open|close):(\d+)/gi, (_: any, eventName: any, timing: any) => {
            setTimeout(() => {
                emitter.emit(eventName);
            }, parseInt(timing));
        });
        return {
            on: (eventName: string, listener: any) => emitter.on(eventName, listener),
            close: () => emitter.emit("close"),
            url,
        };
    });
});

describe("createVegaConnectionManager", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it("works sending a single host as a string", () => {
        const onConnected = jest.fn();
        const { connect } = createVegaConnectionManager({
            initialHostList: "host1 open:100",
            onConnected,
        });
        connect();
        jest.runAllTimers();
        expect(onConnected).toHaveBeenCalledTimes(1);
        expect(onConnected).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: "host1 open:100",
            }),
            expect.anything(),
        );
        expect(VegaConnection).toHaveBeenCalledTimes(1);
    });

    it("works sending a multiple hosts as a string", () => {
        const onConnected = jest.fn();
        const { connect } = createVegaConnectionManager({
            initialHostList: "host1 close:100,host2 open:100",
            onConnected,
        });
        connect();
        jest.runAllTimers();
        expect(onConnected).toHaveBeenCalledTimes(1);
        expect(onConnected).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: "host2 open:100",
            }),
            expect.anything(),
        );
        expect(VegaConnection).toHaveBeenCalledTimes(2);
    });

    it("tries connecting to hosts in order provided with delays between them", () => {
        const { connect } = createVegaConnectionManager({
            initialHostList: [
                { host: "host1", dc: "a" },
                { host: "host2", dc: "b" },
                { host: "host3", dc: "a" },
            ],
        });
        connect();
        jest.advanceTimersToNextTimer();
        expect(VegaConnection).toHaveBeenCalledTimes(1);
        expect(VegaConnection).toHaveBeenNthCalledWith(1, "host1");
        jest.advanceTimersToNextTimer();
        expect(VegaConnection).toHaveBeenCalledTimes(2);
        expect(VegaConnection).toHaveBeenNthCalledWith(2, "host2");
        jest.advanceTimersToNextTimer();
        expect(VegaConnection).toHaveBeenCalledTimes(3);
        expect(VegaConnection).toHaveBeenNthCalledWith(3, "host3");
    });

    it("emits successful connection and doesn't attempt to connect to other hosts after if fast enough", () => {
        const onConnected = jest.fn();
        const { connect } = createVegaConnectionManager({
            initialHostList: [
                { host: "host1", dc: "a" },
                { host: "host2 open:100", dc: "b" },
                { host: "host3", dc: "a" },
                { host: "host4", dc: "a" },
            ],
            onConnected,
        });
        connect();
        jest.runAllTimers();
        expect(onConnected).toHaveBeenCalledTimes(1);
        expect(onConnected).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: "host2 open:100",
            }),
            expect.anything(),
        );
        expect(VegaConnection).toHaveBeenCalledTimes(2);
    });

    it("tries multiple hosts in parallel if slow, but only emits the one that opens first (even if all opens)", () => {
        const onConnected = jest.fn();
        const { connect } = createVegaConnectionManager({
            initialHostList: [
                { host: "host1 open:7000", dc: "a" },
                { host: "host2 open:5000", dc: "b" },
                { host: "host3 open:2000", dc: "c" },
                { host: "host4 open:5000", dc: "d" },
            ],
            onConnected,
        });
        connect();
        jest.runAllTimers();
        expect(onConnected).toHaveBeenCalledTimes(1);
        expect(onConnected).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: "host3 open:2000",
            }),
            expect.anything(),
        );
        expect(VegaConnection).toHaveBeenCalledTimes(4);
    });

    it("emits failed if all hosts fail", () => {
        const onConnected = jest.fn();
        const onFailed = jest.fn();
        const { connect } = createVegaConnectionManager({
            initialHostList: [
                { host: "host1 close:100", dc: "a" },
                { host: "host2 close:100", dc: "b" },
                { host: "host3 close:100", dc: "c" },
                { host: "host4 close:100", dc: "d" },
            ],
            onConnected,
            onFailed,
        });
        connect();
        jest.runAllTimers();
        expect(onConnected).toHaveBeenCalledTimes(0);
        expect(VegaConnection).toHaveBeenCalledTimes(4);
        expect(onFailed).toHaveBeenCalledTimes(1);
    });

    it("doesn't run multiple times if called while in progress, if one of the hosts connect", () => {
        const onConnected = jest.fn();
        const onFailed = jest.fn();
        const { connect } = createVegaConnectionManager({
            initialHostList: [
                { host: "host1 close:100", dc: "a" },
                { host: "host2 close:100", dc: "b" },
                { host: "host3 open:100", dc: "c" },
                { host: "host4 close:100", dc: "d" },
            ],
            onConnected,
            onFailed,
        });
        connect();
        jest.advanceTimersToNextTimer();
        connect(); // is ignored
        jest.advanceTimersToNextTimer();
        connect(); // is ignored
        connect(); // is ignored
        jest.runAllTimers();
        expect(VegaConnection).toHaveBeenCalledTimes(3);
        expect(onConnected).toHaveBeenCalledTimes(1);
        expect(onFailed).toHaveBeenCalledTimes(0);
    });

    it("will run (only) once more, if connect() is called again while first round is in progress, if all fails, so hostlist or network can change followed by a new connect()", () => {
        const onConnected = jest.fn();
        const onFailed = jest.fn();
        const { connect, updateHostList } = createVegaConnectionManager({
            initialHostList: [
                { host: "host1 close:100", dc: "a" },
                { host: "host2 close:100", dc: "b" },
                { host: "host3 close:100", dc: "c" },
                { host: "host4 close:100", dc: "d" },
            ],
            onConnected,
            onFailed,
        });
        connect();
        jest.advanceTimersToNextTimer();
        updateHostList([
            { host: "host1 close:100", dc: "a" },
            { host: "host2 close:100", dc: "b" },
            { host: "host3new open:100", dc: "c" },
            { host: "host4 close:100", dc: "d" }, // never attempted as previous connects
        ]);
        connect();
        jest.advanceTimersToNextTimer();
        connect();
        connect();
        connect(); // sum of all these connects will result in 1 extra run, with updated hostlist
        jest.runAllTimers();
        expect(onConnected).toHaveBeenCalledTimes(1);
        expect(onConnected).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: "host3new open:100",
            }),
            expect.anything(),
        );
        expect(VegaConnection).toHaveBeenCalledTimes(7);
        expect(onFailed).toHaveBeenCalledTimes(0);
    });

    it("will treat a close shortly after open as a failed connection", () => {
        const onConnected = jest.fn();
        const { connect } = createVegaConnectionManager({
            initialHostList: [
                { host: "host1", dc: "a" },
                { host: "host2 open:100 close:150", dc: "b" }, // failed connection
                { host: "host3 open:100", dc: "c" },
                { host: "host4", dc: "d" },
            ],
            onConnected,
        });
        connect();
        jest.runAllTimers();
        expect(onConnected).toHaveBeenCalledTimes(1);
        expect(onConnected).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: "host3 open:100",
            }),
            expect.anything(),
        );
        expect(VegaConnection).toHaveBeenCalledTimes(3);
    });

    it("will treat a close long after open as a successful connection, and emit disconnected not failed when closing", () => {
        const onConnected = jest.fn();
        const onDisconnected = jest.fn();
        const onFailed = jest.fn();
        const { connect } = createVegaConnectionManager({
            initialHostList: [
                { host: "host1", dc: "a" },
                { host: "host2 open:100 close:5000", dc: "b" }, // successful connection, closes later
                { host: "host3 open:100", dc: "c" },
                { host: "host4", dc: "d" },
            ],
            onConnected,
            onDisconnected,
            onFailed,
        });
        connect();
        jest.runAllTimers();
        expect(onConnected).toHaveBeenCalledTimes(1);
        expect(onConnected).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: "host2 open:100 close:5000",
            }),
            expect.anything(),
        );
        expect(onFailed).toHaveBeenCalledTimes(0);
        expect(onDisconnected).toHaveBeenCalledTimes(1);
        expect(VegaConnection).toHaveBeenCalledTimes(2);
    });

    it("will retry the last connected host shortly after network problems, the old or updated hostlist after a while", () => {
        const onConnected = jest.fn();
        const onDisconnected = jest.fn();
        const { connect, updateHostList } = createVegaConnectionManager({
            initialHostList: [
                { host: "badhost1 close:100", dc: "a" },
                { host: "goodhost1 open:100 close:5000", dc: "b" },
                { host: "badhost2 close:5000", dc: "c" },
            ],
            onConnected,
            onDisconnected,
        });
        connect();
        jest.runAllTimers();
        expect(onConnected).toHaveBeenCalledTimes(1);
        expect(onConnected).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: "goodhost1 open:100 close:5000",
            }),
            expect.anything(),
        );
        expect(VegaConnection).toHaveBeenCalledTimes(2);
        expect(onDisconnected).toHaveBeenCalledTimes(1);

        // at this point vega connection is just closed

        // we got updated hostlist
        updateHostList([
            { host: "newbadhost1 close:100", dc: "a" },
            { host: "newbadhost2 close:100", dc: "b" },
            { host: "newgoodhost1 open:100", dc: "c" },
        ]);

        // reconnect attempt shorty after
        jest.advanceTimersByTime(1000);
        connect();

        jest.runAllTimers();
        expect(onConnected).toHaveBeenCalledTimes(2); // connected for the 2nd time
        expect(onConnected).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: "goodhost1 open:100 close:5000", // but same host
            }),
            expect.anything(),
        );
        expect(VegaConnection).toHaveBeenCalledTimes(3); // only 1 more connection is tested
        expect(onDisconnected).toHaveBeenCalledTimes(2); // and disconnects after a while

        // we are closed again
        // but this time we wait longer before connect
        jest.advanceTimersByTime(5000);
        connect();

        jest.runAllTimers();
        expect(onConnected).toHaveBeenCalledTimes(3); // connected for the 3rd time
        expect(onConnected).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: "newgoodhost1 open:100", // the updated host is used now
            }),
            expect.anything(),
        );
        expect(VegaConnection).toHaveBeenCalledTimes(6); // 3 more connection are tested
    });

    it("will provide analytics, updated and aggregated across multiple calls to connect()", () => {
        const onConnected = jest.fn();
        const { connect, updateHostList } = createVegaConnectionManager({
            initialHostList: [
                { host: "host1 close:100", dc: "a" },
                { host: "host2 open:100 close:5000", dc: "b" },
                { host: "host3 open:100", dc: "c" },
                { host: "host4 open:100", dc: "d" },
            ],
            onConnected,
        });
        connect();
        jest.runAllTimers();
        const initialExpectedAnalytics = {
            host: "host2 open:100 close:5000",
            dc: "b",
            initialHost: "host2 open:100 close:5000",
            initialDC: "b",
            initialHostIndex: 1,
            initialDCIndex: 1,
            usedHosts: ["host2 open:100 close:5000"],
            usedDCs: ["b"],
            failedHosts: ["host1 close:100"], // only this has failed, the rest we dont know
            failedDCs: ["a"], // only this has failed, the rest we dont know
            numConnections: 1, // we have only connected once
            numUsedHosts: 1,
            numUsedDCs: 1,
            numFailedHosts: 1,
            numFailedDCs: 1,
        };
        expect(onConnected).toHaveBeenCalledTimes(1);
        expect(onConnected).toHaveBeenLastCalledWith(
            expect.anything(),
            expect.objectContaining(initialExpectedAnalytics),
        );

        connect();
        jest.runAllTimers();
        expect(onConnected).toHaveBeenCalledTimes(2);
        expect(onConnected).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.objectContaining({ ...initialExpectedAnalytics, numConnections: 2 }),
        );

        updateHostList([
            { host: "host1 close:100", dc: "a" },
            { host: "host2 close:100", dc: "b" },
            { host: "host3 close:100", dc: "c" },
            { host: "host4 close:100", dc: "d" },
            { host: "host5 open:100 close:5000", dc: "a" },
        ]);
        jest.advanceTimersByTime(5000);
        connect();
        jest.runAllTimers();
        expect(onConnected).toHaveBeenCalledTimes(3);
        expect(onConnected).toHaveBeenNthCalledWith(
            3,
            expect.anything(),
            expect.objectContaining({
                ...initialExpectedAnalytics,
                numConnections: 3,
                host: "host5 open:100 close:5000",
                dc: "a",
                usedHosts: [...initialExpectedAnalytics.usedHosts, "host5 open:100 close:5000"],
                usedDCs: ["b", "a"],
                numUsedHosts: 2,
                numUsedDCs: 2,
                failedHosts: ["host1 close:100", "host2 close:100", "host3 close:100", "host4 close:100"], // host2 close is not the same as host2 open
                failedDCs: ["c", "d"], // a didn't fail afterall as we connected second round
                numFailedHosts: 4,
                numFailedDCs: 2,
            }),
        );
    });
});
