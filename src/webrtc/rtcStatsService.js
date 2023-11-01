// ensure adapter is loaded first.
import adapter from "webrtc-adapter"; // eslint-disable-line no-unused-vars
import rtcstats from "rtcstats";
import { v4 as uuidv4 } from "uuid";

const RTCSTATS_PROTOCOL_VERSION = "1.0";

const clientInfo = {
    id: uuidv4(), // shared id across rtcstats reconnects
    connectionNumber: 0,
};

// Inlined version of rtcstats/trace-ws with improved disconnect handling.
function rtcStatsConnection(wsURL, logger = console) {
    const buffer = [];
    let ws;
    let organizationId;
    let clientId;
    let displayName;
    let userRole;
    let roomSessionId;
    let connectionShouldBeOpen;
    let connectionAttempt = 0;
    let hasPassedOnRoomSessionId = false;

    const connection = {
        connected: false,
        trace: (...args) => {
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
                    if (ws) {
                        ws.close();
                        return;
                    }
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
            }

            if (ws.readyState === WebSocket.OPEN) {
                connectionAttempt = 0;
                ws.send(JSON.stringify(args));
            } else if (args[0] !== "getstats" && !(args[0] === "customEvent" && args[2].type === "insightsStats")) {
                // buffer all but stats when not connected
                buffer.push(args);
            }

            // reconnect when closed by anything else than client
            if (ws.readyState === WebSocket.CLOSED && connectionShouldBeOpen) {
                setTimeout(() => {
                    if (ws.readyState === WebSocket.CLOSED && connectionShouldBeOpen) {
                        connection.connect();
                    }
                }, 1000 * connectionAttempt);
            }
        },
        close: () => {
            connectionShouldBeOpen = false;
            if (ws) {
                ws.close();
            }
        },
        connect: () => {
            connectionShouldBeOpen = true;
            connectionAttempt += 1;
            if (ws) {
                ws.close();
            }
            connection.connected = true;
            ws = new WebSocket(wsURL + window.location.pathname, RTCSTATS_PROTOCOL_VERSION);

            ws.onerror = (e) => {
                connection.connected = false;
                logger.warn(`[RTCSTATS] WebSocket error`, e);
            };
            ws.onclose = (e) => {
                connection.connected = false;
                logger.info(`[RTCSTATS] Closed ${e.code}`);
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

                // send buffered events (non-getStats)
                while (buffer.length) {
                    ws.send(JSON.stringify(buffer.shift()));
                }
            };
        },
    };
    connection.connect();
    return connection;
}

const server = rtcStatsConnection(process.env.RTCSTATS_URL || "wss://rtcstats.srv.whereby.com");
rtcstats(
    server.trace,
    10000, // query once every 10 seconds.
    [""] // only shim unprefixed RTCPeerConnecion.
);

const rtcStats = {
    sendEvent: (type, value) => {
        server.trace("customEvent", null, {
            type,
            value,
        });
    },
    sendAudioMuted: (muted) => {
        rtcStats.sendEvent("audio_muted", { muted });
    },
    sendVideoMuted: (muted) => {
        rtcStats.sendEvent("video_muted", { muted });
    },
    server,
};
export default rtcStats;
