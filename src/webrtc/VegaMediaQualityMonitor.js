import EventEmitter from "events";
import { PROTOCOL_EVENTS } from "../model/protocol";
import Logger from "../utils/Logger";

const logger = new Logger();

export const MEDIA_QUALITY = Object.freeze({
    ok: "ok",
    warning: "warning",
    critical: "critical",
});

const MONITOR_INTERVAL = 600; // ms
const TREND_HORIZON = 3; // number of monitor intervals needed for quality to change
const WARNING_SCORE = 9;
const CRITICAL_SCORE = 7;

export default class VegaMediaQualityMonitor extends EventEmitter {
    constructor() {
        super();
        this._clients = {};
        this._producers = {};
        this._startMonitor();
    }

    close() {
        clearInterval(this._intervalHandle);
        delete this._intervalHandle;
        this._producers = {};
        this._clients = {};
    }

    _startMonitor() {
        this._intervalHandle = setInterval(() => {
            Object.entries(this._producers).forEach(([clientId, producers]) => {
                this._evaluateClient(clientId, producers);
            });
        }, MONITOR_INTERVAL);
    }

    _evaluateClient(clientId, producers) {
        if (!this._clients[clientId]) {
            this._clients[clientId] = {
                audio: { currentQuality: MEDIA_QUALITY.ok, trend: [] },
                video: { currentQuality: MEDIA_QUALITY.ok, trend: [] },
            };
        }

        this._evaluateProducer(
            clientId,
            Object.values(producers).filter((p) => p.kind === "audio"),
            "audio"
        );
        this._evaluateProducer(
            clientId,
            Object.values(producers).filter((p) => p.kind === "video"),
            "video"
        );
    }

    _evaluateProducer(clientId, producers, kind) {
        if (producers.length === 0) {
            return;
        }

        const avgScore = producers.reduce((prev, curr) => prev + curr.score, 0) / producers.length;
        const newQuality = this._evaluateScore(avgScore);
        const qualityChanged = this._updateTrend(newQuality, this._clients[clientId][kind]);
        if (qualityChanged) {
            this.emit(PROTOCOL_EVENTS.MEDIA_QUALITY_CHANGED, {
                clientId,
                kind,
                quality: newQuality,
            });
        }
    }

    _updateTrend(newQuality, state) {
        state.trend.push(newQuality);
        if (state.trend.length > TREND_HORIZON) {
            state.trend.shift();
        }

        if (newQuality !== state.currentQuality && state.trend.every((t) => t !== state.currentQuality)) {
            state.currentQuality = newQuality;
            return true;
        } else {
            return false;
        }
    }

    addProducer(clientId, producerId) {
        if (!clientId || !producerId || !(typeof clientId === "string" && typeof producerId === "string")) {
            logger.warn("Missing clientId or producerId");
            return;
        }

        if (!this._producers[clientId]) {
            this._producers[clientId] = {};
        }

        this._producers[clientId][producerId] = {};
    }

    removeProducer(clientId, producerId) {
        delete this._producers[clientId][producerId];

        if (Object.keys(this._producers[clientId]).length === 0) {
            delete this._producers[clientId];
        }
    }

    addConsumer(clientId, consumerId) {
        if (!clientId || !consumerId) {
            logger.warn("Missing clientId or consumerId");
            return;
        }

        if (!this._producers[clientId]) {
            this._producers[clientId] = {};
        }

        this._producers[clientId][consumerId] = {};
    }

    removeConsumer(clientId, consumerId) {
        delete this._producers[clientId][consumerId];

        if (Object.keys(this._producers[clientId]).length === 0) {
            delete this._producers[clientId];
        }
    }

    addProducerScore(clientId, producerId, kind, score) {
        if (
            !Array.isArray(score) ||
            score.length === 0 ||
            score.some((s) => !s || !s.hasOwnProperty("score") || typeof s.score !== "number" || isNaN(s.score))
        ) {
            logger.warn("Unexpected producer score format");
            return;
        }
        this._producers[clientId][producerId] = { kind, score: this._calcAvgProducerScore(score.map((s) => s.score)) };
    }

    addConsumerScore(clientId, consumerId, kind, score) {
        if (!score || !score.hasOwnProperty("producerScores") || !Array.isArray(score.producerScores)) {
            logger.warn("Unexpected consumer score format");
            return;
        }
        this._producers[clientId][consumerId] = { kind, score: this._calcAvgProducerScore(score.producerScores) };
    }

    _evaluateScore(score) {
        if (score <= WARNING_SCORE && score > CRITICAL_SCORE) {
            return MEDIA_QUALITY.warning;
        } else if (score <= CRITICAL_SCORE && score > 0) {
            return MEDIA_QUALITY.critical;
        } else {
            return MEDIA_QUALITY.ok;
        }
    }

    _calcAvgProducerScore(scores) {
        try {
            if (!Array.isArray(scores) || scores.length === 0) {
                return 0;
            }

            let totalScore = 0;
            let divisor = 0;

            scores.forEach((score) => {
                if (score > 0) {
                    totalScore += score;
                    divisor++;
                }
            });

            if (totalScore === 0 || divisor === 0) {
                return 0;
            } else {
                return totalScore / divisor;
            }
        } catch (error) {
            logger.error(error);
            return 0;
        }
    }
}
