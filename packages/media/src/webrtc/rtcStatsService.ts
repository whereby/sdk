// ensure adapter is loaded first.
import adapterRaw from "webrtc-adapter";
import rtcstats from "rtcstats";
import { v4 as uuidv4 } from "uuid";

// @ts-ignore
const adapter = adapterRaw.default ?? adapterRaw;

const RTCSTATS_PROTOCOL_VERSION = "1.0";

// when not connected we need to buffer at least a few getstats reports
// as they are delta compressed and we need the initial properties
const GETSTATS_BUFFER_SIZE = 20;

const clientInfo = {
    id: uuidv4(), // shared id across rtcstats reconnects
    connectionNumber: 0,
};

const noop = () => {};
let resetDelta = noop;

// Inlined version of rtcstats/trace-ws with improved disconnect handling.
function rtcStatsConnection(wsURL: string, logger: any = console) {
    const buffer: any = [];
    let ws: WebSocket;
    let organizationId: number;
    let clientId: string;
    let displayName: string;
    let userRole: string;
    let roomSessionId: any;
    let connectionShouldBeOpen: any;
    let connectionAttempt = 0;
    let hasPassedOnRoomSessionId = false;
    let getStatsBufferUsed = 0;
    let deviceId: string;
    let roomProduct: string;
    let roomMode: string;
    let sfuServer: string;
    let featureFlags: string;

    const connection = {
        connected: false,
        trace: (...args: any) => {
            args.push(Date.now());

            if (args[0] === "customEvent" && args[2].type === "roomSessionId") {
                const oldRoomSessionIdValue = roomSessionId && roomSessionId[2].value.roomSessionId;
                const newRoomSessionIdValue = args[2].value.roomSessionId;
                roomSessionId = args;

                if (
                    hasPassedOnRoomSessionId &&
                    newRoomSessionIdValue &&
                    newRoomSessionIdValue !== oldRoomSessionIdValue
                ) {
                    // roomSessionId was already sent. It may have been reset to null, but anything after should be part of the same
                    // session. Now it is something else, and we force a reconnect to start a new session
                    ws?.close();
                }
                if (newRoomSessionIdValue) hasPassedOnRoomSessionId = true;
            } else if (args[0] === "customEvent" && args[2].type === "clientId") {
                clientId = args;
            } else if (args[0] === "customEvent" && args[2].type === "organizationId") {
                organizationId = args;
            } else if (args[0] === "customEvent" && args[2].type === "displayName") {
                displayName = args;
            } else if (args[0] === "customEvent" && args[2].type === "userRole") {
                userRole = args;
            } else if (args[0] === "customEvent" && args[2].type === "deviceId") {
                deviceId = args;
            } else if (args[0] === "customEvent" && args[2].type === "roomProduct") {
                roomProduct = args;
            } else if (args[0] === "customEvent" && args[2].type === "roomMode") {
                roomMode = args;
            } else if (args[0] === "customEvent" && args[2].type === "sfuServer") {
                sfuServer = args;
            } else if (args[0] === "customEvent" && args[2].type === "featureFlags") {
                featureFlags = args;
            }

            if (ws?.readyState === WebSocket.OPEN) {
                connectionAttempt = 0;
                ws.send(JSON.stringify(args));
            } else if (args[0] === "getstats") {
                // only buffer getStats for a while
                // we don't want this to pile up, but we need at least the initial reports
                if (getStatsBufferUsed < GETSTATS_BUFFER_SIZE) {
                    getStatsBufferUsed++;
                    buffer.push(args);
                }
            } else if (args[0] === "customEvent" && args[2].type === "insightsStats") {
                // don't buffer insightStats
            } else {
                // buffer everything else
                buffer.push(args);
            }

            // reconnect when closed by anything else than client
            if (ws?.readyState === WebSocket.CLOSED && connectionShouldBeOpen) {
                setTimeout(() => {
                    if (ws.readyState === WebSocket.CLOSED && connectionShouldBeOpen) {
                        connection.connect();
                    }
                }, 1000 * connectionAttempt);
            }
        },
        close: () => {
            connectionShouldBeOpen = false;
            ws?.close();
        },
        connect: () => {
            connectionShouldBeOpen = true;
            connectionAttempt += 1;
            ws?.close();
            connection.connected = true;
            ws = new WebSocket(wsURL + window.location.pathname, RTCSTATS_PROTOCOL_VERSION);

            ws.onerror = (e: Event) => {
                connection.connected = false;
                logger.warn(`[RTCSTATS] WebSocket error`, e);
            };
            ws.onclose = (e: CloseEvent) => {
                connection.connected = false;
                logger.info(`[RTCSTATS] Closed ${e.code}`);
                resetDelta();
            };
            ws.onopen = () => {
                // send client info after each connection, so analysis tools can handle reconnections
                clientInfo.connectionNumber++;
                ws.send(JSON.stringify(["clientInfo", null, clientInfo]));

                if (organizationId) {
                    ws.send(JSON.stringify(organizationId));
                }
                if (clientId) {
                    ws.send(JSON.stringify(clientId));
                }
                if (roomSessionId) {
                    ws.send(JSON.stringify(roomSessionId));
                }
                if (displayName) {
                    ws.send(JSON.stringify(displayName));
                }
                if (userRole) {
                    ws.send(JSON.stringify(userRole));
                }
                if (deviceId) {
                    ws.send(JSON.stringify(deviceId));
                }
                if (roomMode) {
                    ws.send(JSON.stringify(roomMode));
                }
                if (roomProduct) {
                    ws.send(JSON.stringify(roomProduct));
                }
                if (sfuServer) {
                    ws.send(JSON.stringify(sfuServer));
                }
                if (featureFlags) {
                    ws.send(JSON.stringify(featureFlags));
                }

                // send buffered events
                while (buffer.length) {
                    ws.send(JSON.stringify(buffer.shift()));
                }
                getStatsBufferUsed = 0;
            };
        },
    };

    return connection;
}

const server = rtcStatsConnection(process.env.RTCSTATS_URL || "wss://rtcstats.srv.whereby.com");
const stats = rtcstats(
    server.trace,
    10000, // query once every 10 seconds.
    [""], // only shim unprefixed RTCPeerConnecion.
);
// on node clients this function can be undefined
resetDelta = stats?.resetDelta || noop;

const rtcStats = {
    sendEvent: (type: any, value: any) => {
        server.trace("customEvent", null, {
            type,
            value,
        });
    },
    sendAudioMuted: (muted: boolean) => {
        rtcStats.sendEvent("audio_muted", { muted });
    },
    sendVideoMuted: (muted: boolean) => {
        rtcStats.sendEvent("video_muted", { muted });
    },
    server,
};
export default rtcStats;
