import EventEmitter from "events";
import { Device } from "mediasoup-client";
import VegaConnection from "./VegaConnection";
import { modifyMediaCapabilities } from "../utils/mediaSettings";
import { getHandler } from "../utils/getHandler";
import { generateByteString, createWorker } from "../utils/bandwidthTestUtils";

const logger = console;

const MSG_SIZE = 1024;
const BUFFER_LIMIT = 4 * 1024 * 1024;
const LOOP_LIMIT = 1000;
const RETRY_LIMIT = 5;
const START_DELAY = 1;

export default class BandwidthTester extends EventEmitter {
    constructor({ features } = {}) {
        super();

        this.closed = false;

        this._features = features || {};

        this._vegaConnection = null;

        this._mediasoupDevice = new Device({ handlerName: getHandler() });
        this._routerRtpCapabilities = null;

        this._sendTransport = null;
        this._receiveTransport = null;

        this._dataProducer = null;
        this._dataConsumer = null;

        this._rawData = generateByteString(MSG_SIZE);

        this._scheduler = createWorker((e) => {
            if (e.data.sleep > 0) {
                setTimeout(() => {
                    postMessage(e.data);
                }, e.data.sleep);
            } else {
                postMessage(e.data);
            }
        });

        this._timeout = null;

        this._runTime = 10; // Seconds

        this._testStartTime = null;
        this._testEndTime = null;
        this._testRunning = false;
        this._loopLimit = LOOP_LIMIT;
        this._loopCount = 0;

        this._messagesSent = 0;
        this._messagesReceived = 0;

        this._dataProducerReady = new Promise((resolve) => {
            this._resolveDataProducerReady = resolve;
        });

        this._dataConsumerReady = new Promise((resolve) => {
            this._resolveDataConsumerReady = resolve;
        });

        this._dataReady = Promise.all([this._dataProducerReady, this._dataConsumerReady]);
    }

    // This is the public API for this class
    start(runTime = 21) {
        if (this.closed) {
            return;
        }

        this._runTime = runTime - RETRY_LIMIT - START_DELAY;

        const host = this._features.sfuServerOverrideHost || "any.sfu.whereby.com";
        const wsUrl = `wss://${host}`;

        this._vegaConnection = new VegaConnection(wsUrl, logger, "whereby-sfu#bw-test-v1");
        this._vegaConnection.on("open", () => this._start());
        this._vegaConnection.on("close", () => this.close());
        this._vegaConnection.on("message", (message) => this._onMessage(message));

        // If we don't get a response within 10 seconds, we close the test
        this._timeout = setTimeout(() => {
            this.emit("result", {
                error: true,
                details: {
                    timeout: true,
                },
            });

            this.close();
        }, this._runTime * 1000);
    }

    close() {
        logger.debug("close()");

        this.closed = true;

        clearTimeout(this._timeout);
        this._timeout = null;

        if (this._scheduler) {
            this._scheduler.terminate();
        }

        this._scheduler = null;

        if (this._dataConsumer) {
            this._dataConsumer.removeAllListeners();
            this._dataConsumer.close();
        }

        this._dataConsumer = null;

        if (this._dataProducer) {
            this._dataProducer.removeAllListeners();
            this._dataProducer.close();
        }

        this._dataProducer = null;

        if (this._sendTransport) {
            this._sendTransport.removeAllListeners();
            this._sendTransport.close();
        }

        this._sendTransport = null;

        if (this._receiveTransport) {
            this._receiveTransport.removeAllListeners();
            this._receiveTransport.close();
        }

        this._receiveTransport = null;

        this._mediasoupDevice = null;

        if (this._vegaConnection) {
            this._vegaConnection.removeAllListeners();
            this._vegaConnection.close();
        }

        this._vegaConnection = null;

        this.emit("close");
    }

    async _start() {
        logger.debug("_start()");

        try {
            // We need to always do this, as this triggers the start logic on the SFU
            const { routerRtpCapabilities } = await this._vegaConnection.request("getCapabilities");

            if (!this._routerRtpCapabilities) {
                modifyMediaCapabilities(routerRtpCapabilities, this._features);

                this._routerRtpCapabilities = routerRtpCapabilities;
                await this._mediasoupDevice.load({ routerRtpCapabilities });
            }

            this._vegaConnection.message("setCapabilities", {
                rtpCapabilities: this._mediasoupDevice.rtpCapabilities,
            });

            await Promise.all([this._createTransport(true), this._createTransport(false)]);

            if (!this._dataProducer) await this._createDataProducer();

            await this._runTest();
        } catch (error) {
            logger.error("_start() [error:%o]", error);

            this.emit("result", {
                error: true,
                details: {
                    timeout: true,
                },
            });

            this.close();
        }
    }

    async _createTransport(send) {
        const creator = send ? "createSendTransport" : "createRecvTransport";

        const transportOptions = await this._vegaConnection.request("createTransport", {
            producing: send,
            consuming: !send,
            enableTcp: true,
            enableUdp: true,
            preferUdp: true,
            sctpParameters: {
                enableSctp: true,
                numSctpStreams: {
                    OS: 1024,
                    MIS: 1024,
                },
                maxSctpMessageSize: 262144,
                sctpSendBufferSize: 262144,
            },
        });

        transportOptions.iceServers = [{ urls: "stun:any.turn.whereby.com" }];

        const transport = this._mediasoupDevice[creator](transportOptions);

        transport.on("connect", ({ dtlsParameters }, callback) => {
            this._vegaConnection.message("connectTransport", {
                transportId: transport.id,
                dtlsParameters,
            });

            callback();
        });

        if (send) {
            transport.on("produce", async ({ kind, rtpParameters, appData }, callback, errback) => {
                try {
                    const { paused } = appData;

                    const { id } = await this._vegaConnection.request("produce", {
                        transportId: transport.id,
                        kind,
                        rtpParameters,
                        paused,
                        appData,
                    });

                    callback({ id });
                } catch (error) {
                    errback(error);
                }
            });
            transport.on("producedata", async ({ appData, sctpStreamParameters }, callback, errback) => {
                try {
                    const { id } = await this._vegaConnection.request("produceData", {
                        transportId: transport.id,
                        sctpStreamParameters,
                        appData,
                    });
                    callback({ id });
                } catch (error) {
                    errback(error);
                }
            });

            this._sendTransport = transport;
        } else {
            this._receiveTransport = transport;
        }
    }

    async _createDataProducer() {
        if (this._dataProducer) return;

        const dataProducer = await this._sendTransport.produceData({
            ordered: false,
            maxPacketLifeTime: 1000,
            priority: "high",
            label: "tester",
            protocol: "tester",
        });

        this._dataProducer = dataProducer;

        dataProducer.bufferedAmountLowThreshold = 1024;

        dataProducer.once("close", () => {
            this._dataProducer = null;
        });

        if (dataProducer.readyState === "open") {
            logger.debug("dataProducer open");
            this._resolveDataProducerReady();
        } else {
            dataProducer.once("open", () => {
                logger.debug("dataProducer open");

                this._resolveDataProducerReady();
            });
        }
    }

    async _onMessage(message) {
        const { method, data } = message;
        return Promise.resolve()
            .then(() => {
                switch (method) {
                    case "dataConsumerReady":
                        return this._onDataConsumerReady(data);
                    case "dataConsumerClosed":
                        return this._onDataConsumerClosed(data);
                    default:
                        logger.debug(`unknown message method "${method}"`);
                        return;
                }
            })
            .catch((error) => {
                console.error('"message" failed [error:%o]', error);
            });
    }

    async _onDataConsumerReady(options) {
        logger.debug("_onDataConsumerReady()", { id: options.id, dataProducerId: options.dataProducerId });

        const consumer = await this._receiveTransport.consumeData(options);

        this._dataConsumer = consumer;

        consumer.once("close", () => {
            this._dataConsumer = null;
        });

        if (consumer.readyState === "open") {
            logger.debug("dataConsumer open");
            this._resolveDataConsumerReady();
        } else {
            consumer.on("open", () => {
                logger.debug("dataConsumer open");
                this._resolveDataConsumerReady();
            });
        }

        consumer.on("message", (message) => {
            this._messagesReceived++;
        });
    }

    async _onDataConsumerClosed({ reason }) {
        logger.debug("_onDataConsumerClosed()", { reason });

        this._dataConsumer.close();
    }

    async _reportResults(retries = 0) {
        clearTimeout(this._timeout);

        if (retries >= RETRY_LIMIT) {
            this.emit("result", {
                error: true,
                details: {
                    retryLimit: true,
                },
            });

            return this.close();
        }

        if (this._dataProducer.bufferedAmount > 1024) {
            this._timeout = setTimeout(() => {
                this._reportResults(retries + 1);
            }, 1000);

            return;
        }

        const testTime = this._testEndTime - this._testStartTime;

        const [localSendStats, localRecvStats] = await Promise.all([
            this._sendTransport.getStats(),
            this._receiveTransport.getStats(),
        ]);

        let localBytesSent = 0;

        localSendStats.forEach((stat) => {
            if (stat.type === "candidate-pair" && stat.state === "succeeded") {
                localBytesSent = stat.bytesSent;
            }
        });

        let localBytesReceived = 0;

        localRecvStats.forEach((stat) => {
            if (stat.type === "candidate-pair" && stat.state === "succeeded") {
                localBytesReceived = stat.bytesReceived;
            }
        });

        const { sendStats: [remoteSendStats = null] = [], recvStats: [remoteRecvStats = null] = [] } =
            await this._vegaConnection.request("getTransportStats");

        const { bytesReceived: remoteBytesReceived } = remoteSendStats || {};
        const { bytesSent: remoteBytesSent } = remoteRecvStats || {};

        const sendBitrate = (localBytesSent * 8) / 1000000 / (testTime / 1000);
        const recvBitrate = (localBytesReceived * 8) / 1000000 / (testTime / 1000);
        const lowSendBitrate = sendBitrate < 1.5; // 1.5 Mbps
        const lowRecvBitrate = recvBitrate < 1.5; // 1.5 Mbps
        const sendLoss = (localBytesSent - remoteBytesReceived) / localBytesSent;
        const recvLoss = (remoteBytesSent - localBytesReceived) / remoteBytesSent;
        const highSendLoss = sendLoss > 0.03; // 3%
        const highRecvLoss = recvLoss > 0.03; // 3%

        const warning = lowRecvBitrate || lowSendBitrate || highRecvLoss || highSendLoss;
        const success = !warning;

        this.emit("result", {
            warning,
            success,
            details: {
                testTime,
                lowSendBitrate,
                lowRecvBitrate,
                highSendLoss,
                highRecvLoss,
                sendBitrate,
                recvBitrate,
                sendLoss,
                recvLoss,
            },
        });

        this.close();
    }

    async _runTest() {
        // Will not proceed until both data consumer and producer are ready
        await this._dataReady;

        if (this.closed) return;

        clearTimeout(this._timeout);

        this._scheduler.onmessage = () => {
            this._testLoop();
        };

        setTimeout(() => {
            if (this.closed) return;

            this._testStartTime = Date.now();
            this._testRunning = true;

            this._testLoop();
        }, START_DELAY * 1000);

        setTimeout(() => {
            if (this.closed) return;

            this._testEndTime = Date.now();
            this._testRunning = false;

            this._reportResults();
        }, this._runTime * 1000 + START_DELAY * 1000);
    }

    _testLoop() {
        if (this.closed) return;

        this._loopCount = 0;

        if (this._testRunning) {
            if (this._dataProducer.bufferedAmount === 0) {
                this._loopLimit = this._loopLimit * 2;
            } else if (this._dataProducer.bufferedAmount > BUFFER_LIMIT) {
                this._loopLimit = this._loopLimit * 0.25;
            }

            while (this._dataProducer.bufferedAmount < BUFFER_LIMIT && this._loopCount < this._loopLimit) {
                this._dataProducer.send(this._rawData);
                this._messagesSent++;
                this._loopCount++;
            }

            this._scheduler.postMessage({ sleep: 10 });
        }
    }
}
