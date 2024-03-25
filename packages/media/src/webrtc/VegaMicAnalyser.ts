const defaultParams = {
    minDecibels: -80, // value 0 will be -80db and below
    maxDecibels: -10, // value 1 will be -10db and higher
    smoothingTimeConstant: 0.8, // smoothing the bins. will depend on sampleRate below
    aggSize: 1, // average/max over last N samples
    sampleRate: 10, // samples/s. smoothing constant's effect will depend on this.
    reportRate: 2, // report every N sample. if doubling samplerate, we should half this to keep the same update rate to SFU
    bins: 32, // number of frequency bands. linear spaced from 0 to audio sample rate / 2 (48khz -> 24khz)
    bands: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
    ],
    //initScript: ["const kalmanFilter3 = new f.KalmanFilter(); return { kalmanFilter3 };"],
    separateTrack: {
        autoGainControl: false,
        noiseSupression: false,
    },
    // scoreScript: [
    //     "let sumLF = 0;",
    //     "let sumHF = 0;",
    //     "for (let i = 0; i < 4; i++) {",
    //     "    sumLF += bins[i];",
    //     "    sumHF += bins[i + 4];",
    //     "}",
    //     "const meanLF = sumLF / 4;",
    //     "const meanHF = sumHF / 4;",
    //     "const normalizedMean = (meanHF) / Math.max(meanLF + meanHF, 0.01);",
    //     "return normalizedMean * 300;",
    // ],
    binFormula: "bin", // if we need to convert/map bin values. index param is available.
    scoreFormula: "300 * bands[1].avg / Math.max(bands[1].avg + bands[0].avg, 0.01)", // the score that will be aggregated (aggSize)
    outFormula: "score", // the out/score sent to SFU
};

import Logger from "../utils/Logger";
import * as scriptFunctions from "./VegaMicAnalyserTools";

const logger = new Logger();

export default function createMicAnalyser({
    micTrack,
    params,
    onScoreUpdated,
}: {
    micTrack: MediaStreamTrack;
    params?: any;
    onScoreUpdated: (data: any) => void;
}) {
    // todo: might need to reuse existing in PWA
    const audioCtx = new AudioContext();

    let analyser: any = null;

    // recreates source (connects track to analyser)
    let source: any = null;
    let lastTrack: MediaStreamTrack | null = null;
    let lastTrackWasOurs = false;
    const setTrack = async (track: MediaStreamTrack | null) => {
        // stop last track if get by us
        if (lastTrack && lastTrackWasOurs) {
            lastTrack.stop();
        }
        lastTrackWasOurs = false;
        if (track && params.separateTrack) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId: lastTrack?.getSettings().deviceId, ...params.separateTrack },
                    video: false,
                });
                track = stream.getAudioTracks()[0];
                lastTrackWasOurs = true;
            } catch (ex) {
                logger.warn("unable to fetch new track for colocation speaker analysis, using current", ex);
            }
        }

        lastTrack = track;
        if (source) {
            source.disconnect();
            source = null;
        }
        if (track) {
            const stream = new MediaStream([track]);
            source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
        }
    };

    // updates analyzer params and restarts sampler
    let samplerInterval: any;
    const setParams = (newParams: any) => {
        clearInterval(samplerInterval);

        params = { ...defaultParams, ...newParams };

        if (!analyser || analyser.fftSize !== params.bins * 2) {
            let restoreTrack = null;
            if (analyser) {
                restoreTrack = lastTrack;
                setTrack(null);
            }
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = params.bins * 2;
            if (restoreTrack) setTrack(restoreTrack);
        }

        const bins = new Uint8Array(analyser.frequencyBinCount);
        const scores: any = [];

        analyser.minDecibels = params.minDecibels;
        analyser.maxDecibels = params.maxDecibels;
        analyser.smoothingTimeConstant = params.smoothingTimeConstant;

        // todo: we have to guard this somehow - so that it can't be used for js-injection in meetings
        // it is needed for tweaking the scoring algorithm and the output sent to SFU

        const initScriptFunc =
            // eslint-disable-next-line no-new-func
            params.initScript && new Function("f", "setTrack", "lastTrack", params.initScript.join("\n"));

        // eslint-disable-next-line no-new-func
        const scoreScriptFunc = params.scoreScript && new Function("bins", "g", "f", params.scoreScript.join("\n"));

        // eslint-disable-next-line no-new-func
        const calcScore = params.scoreFormula && new Function("bands", `return ${params.scoreFormula}`);
        const getOutValue =
            // eslint-disable-next-line no-new-func
            params.outFormula && new Function("score", "avg", "max", "scores", `return ${params.outFormula}`);
        // eslint-disable-next-line no-new-func
        const binMap = params.binFormula && new Function("bin", "index", `return ${params.binFormula}`);

        let reportRateCounter = 0;

        const globals = initScriptFunc && initScriptFunc(scriptFunctions, setTrack, lastTrack);

        // fetches data, caluclates score, and updates client
        const sampler = () => {
            analyser.getByteFrequencyData(bins);

            let score = 0;
            if (calcScore) {
                const processedBands = params.bands.map((range: any) => {
                    const bands = range.map((index: number) => binMap(bins[index] / 255, index));
                    return {
                        avg: bands.reduce((sum: number, current: number) => sum + current, 0) / range.length,
                        min: bands.reduce(
                            (min: number, current: number) => Math.min(min, current / 255),
                            Number.MAX_VALUE
                        ),
                        max: bands.reduce((max: number, current: number) => Math.max(max, current / 255), 0),
                    };
                });
                score = calcScore(processedBands) || 0;
            } else if (scoreScriptFunc) {
                score = scoreScriptFunc(bins, globals, scriptFunctions);
                if (isNaN(score)) score = 0;
            }
            scores.push(score);
            if (scores.length > params.aggSize) scores.shift();

            reportRateCounter++;
            if (reportRateCounter >= params.reportRate) {
                reportRateCounter = 0;
                const max = scores.reduce((a: number, b: number) => Math.max(a, b), 0);
                const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
                const out = getOutValue(score, avg, max, scores);
                onScoreUpdated({ bins, score, max, avg, out });
            }
        };

        samplerInterval = setInterval(sampler, 1000 / params.sampleRate);
    };

    // initializaton
    setParams(params);
    setTrack(micTrack);

    return {
        setParams,
        setTrack,
        close() {
            setTrack(null);
            clearInterval(samplerInterval);
            audioCtx.close();
        },
    };
}
