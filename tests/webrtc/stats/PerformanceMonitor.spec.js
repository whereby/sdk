import { startPerformanceMonitor } from "../../../src/webrtc/stats/PerformanceMonitor";

describe("PerformanceMonitor", () => {
    let onMetricsUpdated;
    let onTerminated;
    let isHidden;
    let clock;
    let pm;
    let hidden;

    function hideWindow() {
        hidden = true;
        pm.updateHidden();
    }

    function showWindow() {
        hidden = false;
        pm.updateHidden();
    }

    beforeEach(() => {
        hidden = false;
        clock = sinon.useFakeTimers();
        // requestIdleCallback is not implemented fully in sinon fake timers yet
        // https://github.com/sinonjs/fake-timers/issues/358
        clock.requestIdleCallback = (cb) => cb({ didTimeout: false });
        onMetricsUpdated = sinon.spy();
        onTerminated = sinon.spy();
        isHidden = () => hidden;
        pm = startPerformanceMonitor({ onMetricsUpdated, onTerminated, isHidden });
    });

    afterEach(() => {
        pm.terminate();
        clock.restore();
    });

    it("measures render rate volatility", () => {
        pm.registerDecodedFps([{ trackId: 1, fps: 30 }]);
        clock.tick(1000);
        pm.registerDecodedFps([{ trackId: 1, fps: 10 }]);
        clock.tick(1000);
        pm.registerDecodedFps([{ trackId: 1, fps: 30 }]);
        clock.tick(1000);
        pm.registerDecodedFps([{ trackId: 1, fps: 10 }]);
        clock.tick(1000);

        expect(onMetricsUpdated).to.have.been.calledWith(sinon.match({ all: { rrVol: { cur: 0.5, count: 4 } } }));
    });

    it("ignores samples when window/client is hidden", () => {
        pm.registerDecodedFps([{ trackId: 1, fps: 30 }]);
        clock.tick(1000); // first report

        hideWindow();
        showWindow();
        pm.registerDecodedFps([{ trackId: 1, fps: 10 }]);
        clock.tick(1000); // second report ignored

        pm.registerDecodedFps([{ trackId: 1, fps: 30 }]);
        clock.tick(1000); // third report

        hideWindow();
        showWindow();
        pm.registerDecodedFps([{ trackId: 1, fps: 10 }]);
        clock.tick(1100); // fourth report ignored

        expect(onMetricsUpdated).to.have.been.calledWith(sinon.match({ all: { rrVol: { count: 2, cur: 0 } } }));
    });

    it("keeps track of number of videos", () => {
        pm.registerDecodedFps([
            { trackId: 1, fps: 30 },
            { trackId: 2, fps: 30 },
        ]);

        clock.tick(1000);

        expect(onMetricsUpdated).to.have.been.calledWith(sinon.match({ all: { avc: { cur: 2 } } }));
    });

    it("aggregates measures to (sample)count, sum, min, max and avg", () => {
        // 2 videos
        pm.registerDecodedFps([
            { trackId: 1, fps: 30 },
            { trackId: 2, fps: 30 },
        ]);
        clock.tick(1000);
        // 1 video
        pm.registerDecodedFps([{ trackId: 1, fps: 30 }]);
        clock.tick(1000);

        expect(onMetricsUpdated).to.have.been.calledWith(
            sinon.match({ all: { avc: { count: 2, sum: 3, avg: 1.5, min: 1, max: 2 } } })
        );
    });

    it("aggregates to buckets based on number of videos", () => {
        // 1 video, low rrVol
        pm.registerDecodedFps([{ trackId: 1, fps: 30 }]);
        clock.tick(1000);

        // 2 videos, high rrVol
        pm.registerDecodedFps([
            { trackId: 1, fps: 10 },
            { trackId: 2, fps: 10 },
        ]);
        pm.registerDecodedFps([
            { trackId: 1, fps: 30 },
            { trackId: 2, fps: 30 },
        ]);
        clock.tick(1000);

        expect(onMetricsUpdated).to.have.been.calledWith(
            sinon.match({
                1: { rrVol: { cur: 0, count: 1 } },
                "2to4": { rrVol: { cur: 0.5, count: 1 } },
                all: { rrVol: { cur: 0.5, count: 2 } },
            })
        );
    });

    it("measures setTimeout lag", () => {
        pm.registerDecodedFps([{ trackId: 1, fps: 30 }]);
        clock.tick(1000);

        expect(onMetricsUpdated).to.have.been.calledWith(sinon.match({ all: { stLag: { cur: sinon.match.number } } }));
    });
});
