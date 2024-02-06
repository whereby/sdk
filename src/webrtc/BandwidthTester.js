import EventEmitter from "events";
import { Device } from "mediasoup-client";
import VegaConnection from "./VegaConnection";
import { getMediaSettings, modifyMediaCapabilities } from "../utils/mediaSettings";
import { getHandler } from "../utils/getHandler";
import Logger from "../utils/Logger";

const logger = new Logger();

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

        this._producer = null;
        this._consumers = new Map();

        this._startTime = null;
        this._connectTime = null;
        this._mediaEstablishedTime = null;
        this._runTime = null;
        this._endTime = null;

        this._timeout = null;

        this._canvas = null;
        this._drawInterval = null;

        this._resultTimeout = null;
    }

    // This is the public API for this class
    start(runTime = 15) {
        if (this.closed) {
            return;
        }

        if (runTime < 10) {
            this.emit("result", {
                error: true,
                details: {
                    timeout: true,
                },
            });

            return this.close();
        }

        this._runTime = runTime;
        this._startTime = Date.now();

        const host = this._features.sfuServerOverrideHost || "any.sfu.whereby.com";
        const wsUrl = `wss://${host}`;

        this._vegaConnection = new VegaConnection(wsUrl, "whereby-sfu#bw-test-v1");
        this._vegaConnection.on("open", () => this._start());
        this._vegaConnection.on("close", () => this.close());
        this._vegaConnection.on("message", (message) => this._onMessage(message));

        // If we don't get a response within 5 seconds, we close the test
        this._startTimeout();
    }

    close() {
        logger.info("close()");

        this.closed = true;

        this._clearTimeouts();

        clearInterval(this._drawInterval);
        this._drawInterval = null;

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
        logger.info("_start()");

        // Calculate how long it took to connect and maybe close the test
        this._connectTime = Date.now() - this._startTime;

        if (this._connectTime > 5000) {
            this.emit("result", {
                error: true,
                details: {
                    timeout: true,
                },
            });

            return this.close();
        }

        // Successful connection to SFU, so we can clear the timeout
        this._clearTimeouts();

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
            await this._createProducer();

            // Calculate how long it took to establish media and maybe close the test
            this._mediaEstablishedTime = Date.now() - this._startTime;

            if (this._mediaEstablishedTime > 5000) {
                this.emit("result", {
                    error: true,
                    details: {
                        timeout: true,
                    },
                });

                return this.close();
            }

            // We have established media, start timer to report results and close the test
            this._resultTimeout = setTimeout(
                () => {
                    this._reportResults();
                },
                this._runTime * 1000 - this._mediaEstablishedTime
            );
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

            this._sendTransport = transport;
        } else {
            this._receiveTransport = transport;
        }
    }

    _getTestTrack() {
        this._canvas = document.createElement("canvas");
        this._canvas.width = 1280;
        this._canvas.height = 720;

        document.body.appendChild(this._canvas);

        // Set location to bottom right corner 1 pixel large and transparent
        this._canvas.style.position = "absolute";
        this._canvas.style.right = "0";
        this._canvas.style.bottom = "0";
        this._canvas.style.width = "1px";
        this._canvas.style.height = "1px";
        this._canvas.style.opacity = "0";

        const context = this._canvas.getContext("2d");

        const ball = {
            x: 150,
            y: 150,
        };

        const velocity = 50;
        const startingAngle = 70;
        const rad = 100;

        let moveX = Math.cos((Math.PI / 180) * startingAngle) * velocity;
        let moveY = Math.sin((Math.PI / 180) * startingAngle) * velocity;

        const draw = () => {
            if (this.closed) {
                return;
            }

            const now = Date.now();

            context.fillStyle = `rgb(
                ${Math.floor(255 - 0.35 * ball.y)},
                ${Math.floor(255 - 0.18 * ball.x)},
                0)`;
            context.fillRect(0, 0, this._canvas.width, this._canvas.height);
            context.fillStyle = "white";

            context.font = "30px Arial";
            context.fillText("Whereby", 10, 50);

            context.font = "20px Arial";
            context.fillText("Test", 10, 80);

            context.font = "20px Arial";
            context.fillText(`Time: ${now - this._startTime}ms`, 10, 110);

            context.font = "20px Arial";

            if (this._connectTime) {
                context.fillText(`Connect: ${this._connectTime}ms`, 10, 140);
            }

            if (this._mediaEstablishedTime) {
                context.fillText(`Media: ${this._mediaEstablishedTime}ms`, 10, 170);
            }

            if (ball.x > this._canvas.width - rad || ball.x < rad) moveX = -moveX;
            if (ball.y > this._canvas.height - rad || ball.y < rad) moveY = -moveY;

            ball.x += moveX;
            ball.y += moveY;
            context.beginPath();
            context.fillStyle = `rgb(
                ${Math.floor(255 - 0.18 * ball.x)},
                ${Math.floor(255 - 0.35 * ball.y)},
                0)`;
            context.arc(ball.x, ball.y, rad, 0, Math.PI * 2);
            context.fill();
            context.closePath();
        };

        this._drawInterval = setInterval(draw, 33);

        const fakeStream = this._canvas.captureStream(30);
        const [fakeVideoTrack] = fakeStream.getVideoTracks();

        return fakeVideoTrack;
    }

    async _createProducer() {
        const track = this._getTestTrack();

        const producer = await this._sendTransport.produce({
            track,
            ...getMediaSettings("video", false, this._features),
            appData: {
                paused: false,
            },
        });

        this._producer = producer;

        producer.observer.once("close", () => {
            logger.info('producer "close" event');

            this._producer = null;
        });
    }

    async _onMessage(message) {
        const { method, data } = message;
        return Promise.resolve()
            .then(() => {
                switch (method) {
                    case "consumerReady":
                        return this._onConsumerReady(data);
                    case "consumerClosed":
                        return this._onConsumerClosed(data);
                    default:
                        logger.info(`unknown message method "${method}"`);
                        return;
                }
            })
            .catch((error) => {
                logger.error('"message" failed [error:%o]', error);
            });
    }

    async _onConsumerReady(options) {
        const consumer = await this._receiveTransport.consume(options);

        consumer.once("close", () => {
            this._consumers.delete(consumer.id);
        });

        this._consumers.set(consumer.id, consumer);

        this._vegaConnection.message("resumeConsumers", {
            consumerIds: [consumer.id],
        });
    }

    _onConsumerClosed({ consumerId }) {
        logger.info("_onConsumerClosed()");

        const consumer = this._consumers.get(consumerId);

        if (consumer) {
            consumer.close();
        }
    }

    async _reportResults() {
        const [localSendStats, localRecvStats] = await Promise.all([
            this._sendTransport.getStats(),
            this._receiveTransport.getStats(),
        ]);

        const { recvStats: [remoteRecvStats = null] = [] } = await this._vegaConnection.request("getTransportStats");

        const { availableOutgoingBitrate = 5000000 } = remoteRecvStats || {};

        let outboundPackets = 0;
        let remotePacketsLost = 0;

        localSendStats.forEach((localSendStat) => {
            if (localSendStat.type === "outbound-rtp" && typeof localSendStat.packetsSent === "number") {
                outboundPackets += localSendStat.packetsSent;
            } else if (localSendStat.type === "remote-inbound-rtp" && typeof localSendStat.packetsLost === "number") {
                remotePacketsLost += localSendStat.packetsLost;
            }
        });

        let inboundPackets = 0;
        let packetsLost = 0;

        localRecvStats.forEach((localRecvStat) => {
            if (
                localRecvStat.type === "inbound-rtp" &&
                typeof localRecvStat.packetsReceived === "number" &&
                typeof localRecvStat.packetsLost === "number"
            ) {
                inboundPackets += localRecvStat.packetsReceived;
                packetsLost += localRecvStat.packetsLost;
            }
        });

        const recvAvailableBitrate = availableOutgoingBitrate / 1000000.0;
        const lowRecvAvailableBitrate = recvAvailableBitrate < 1.5; // 1.5 Mbps
        const sendLoss = remotePacketsLost / outboundPackets;
        const recvLoss = packetsLost / inboundPackets;
        const highSendLoss = sendLoss > 0.03; // 3%
        const highRecvLoss = recvLoss > 0.03; // 3%

        const testTime = Date.now() - this._startTime;

        const warning = lowRecvAvailableBitrate || highRecvLoss || highSendLoss;
        const success = !warning;

        this.emit("result", {
            warning,
            success,
            details: {
                testTime,
                recvAvailableBitrate,
                lowRecvAvailableBitrate,
                highSendLoss,
                highRecvLoss,
                sendLoss,
                recvLoss,
            },
        });

        this.close();
    }

    _startTimeout(seconds = 5) {
        this._timeout = setTimeout(() => {
            this.emit("result", {
                error: true,
                details: {
                    timeout: true,
                },
            });

            this.close();
        }, seconds * 1000);
    }

    _clearTimeouts() {
        clearTimeout(this._timeout);
        this._timeout = null;
        clearTimeout(this._reportTimeout);
        this._reportTimeout = null;
    }
}
