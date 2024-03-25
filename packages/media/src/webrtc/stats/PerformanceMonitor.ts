const WINDOW_SIZE = 10;
const SET_TIMEOUT_INTERVAL = 500;
const RIC_TIMEOUT = 500;
const REPORTING_INTERVAL = 1000;

// we measure performance when receiving/decoding at least 1 remote video
// and we separate into 3 additional buckets to measure and track changes on various "loads"
// avc = active video count (currently decoding videos)
const buckets = [
    { name: "all", test: ({ avc }: { avc: number }) => avc >= 1 },
    { name: "1", test: ({ avc }: { avc: number }) => avc === 1 },
    { name: "2to4", test: ({ avc }: { avc: number }) => avc >= 2 && avc <= 4 },
    { name: "5plus", test: ({ avc }: { avc: number }) => avc >= 5 },
];

// performance monitor will measure and report the following fields into the above buckets, with aggregated min, max, avg, cur, sum and count
// rrVol: render rate volatility - how much the decoded fps of remote videos varies (should rise with high system load)
// stLag: how much extra time a setTimeout needs before beeing executed (should rise with high system load)
// ricLag: how much time a requestIdleCallback (when supported) needs before beeing executed (should rise with high system/app load)
// avc: active video count - number of decoded videos (to put the above numbers into context)
//
// The decoded fps / avc is provided outside by registerDecodedFps
// The monitor should be "paused" when window/tab is inactive. This is done by providing a isHidden function/test,
// and updateHidden to force it to run this test. Samples gathered when hidden wholly or partially are discarded.
export function startPerformanceMonitor({
    onMetricsUpdated,
    onTerminated,
    isHidden,
}: {
    onMetricsUpdated: (aggregatedMetrics: any) => void;
    onTerminated: () => void;
    isHidden: () => boolean;
}) {
    const decodedFpsSamplesByTrack = {};
    let currentMetrics: any = {};
    const aggregatedMetrics: any = {};
    let wasHidden = false;

    const reportingInterval = setInterval(() => {
        // ignore samples when tab/window is inactive
        if (wasHidden) {
            wasHidden = isHidden();
            return;
        }

        buckets
            .filter((bucket) => bucket.test(currentMetrics))
            .forEach((bucket) => {
                const bucketData = (aggregatedMetrics[bucket.name] = aggregatedMetrics[bucket.name] || {});
                Object.entries(currentMetrics).forEach(([metric, value]: any) => {
                    if (!bucketData[metric])
                        bucketData[metric] = {
                            min: value,
                            max: value,
                            avg: value,
                            sum: value,
                            cur: value,
                            count: 1,
                        };
                    else {
                        const old = bucketData[metric];
                        bucketData[metric] = {
                            min: Math.min(old.min, value),
                            max: Math.max(old.max, value),
                            avg: (old.sum + value) / (old.count + 1),
                            sum: old.sum + value,
                            cur: value,
                            count: old.count + 1,
                        };
                    }
                });
            });

        onMetricsUpdated?.(aggregatedMetrics);
    }, REPORTING_INTERVAL);

    let stHandle: any = 0;
    let ricHandle: any = 0;
    const measureScheduling = () => {
        const before = performance.now();
        stHandle = setTimeout(() => {
            const delayed = Math.max(0, performance.now() - (before + SET_TIMEOUT_INTERVAL));
            currentMetrics = { ...currentMetrics, stLag: delayed };

            // also measure requestIdleCallback if supported
            // @ts-ignore
            if (window.requestIdleCallback) {
                const beforeRic = performance.now();
                ricHandle = requestIdleCallback(
                    (idleDeadline) => {
                        if (idleDeadline.didTimeout) {
                            currentMetrics = { ...currentMetrics, ricLag: RIC_TIMEOUT };
                        } else {
                            currentMetrics = { ...currentMetrics, ricLag: performance.now() - beforeRic };
                        }
                    },
                    { timeout: RIC_TIMEOUT }
                );
            }

            measureScheduling();
        }, SET_TIMEOUT_INTERVAL);
    };

    // start loop
    measureScheduling();

    return {
        registerDecodedFps: (fpsData: any) => {
            if (wasHidden) return;

            const volatilityScores = fpsData.map(({ trackId, fps }: any) => {
                const samples = ((decodedFpsSamplesByTrack as any)[trackId] =
                    (decodedFpsSamplesByTrack as any)[trackId] || []);
                samples.push(fps) > WINDOW_SIZE && samples.shift();
                const mean = samples.reduce((acc: number, val: number) => acc + val, 0) / samples.length;
                const volatility =
                    samples.reduce((acc: number, val: number) => acc + Math.abs(val - mean), 0) /
                    (samples.length * mean);
                return volatility;
            });

            if (volatilityScores.length) {
                const maxVolatility = Math.max(...volatilityScores);
                currentMetrics = {
                    ...currentMetrics,
                    rrVol: maxVolatility,
                    avc: volatilityScores.length,
                };
            }
        },
        terminate: () => {
            clearInterval(reportingInterval);
            clearTimeout(stHandle);
            if (ricHandle) cancelIdleCallback(ricHandle);
            onTerminated?.();
        },
        updateHidden: () => {
            if (isHidden()) wasHidden = true;
        },
    };
}
