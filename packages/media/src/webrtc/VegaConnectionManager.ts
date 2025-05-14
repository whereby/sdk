import VegaConnection from "./VegaConnection";

// used for analytics, and for reconnecting to last successful host
type ConnectionInfo = {
    host: string;
    dc: string;
    initialHost: string;
    initialDC: string;
    initialHostIndex: number;
    initialDCIndex: number;
    failedDCs: string[];
    numFailedDCs: number;
    failedHosts: string[];
    numFailedHosts: number;
    usedDCs: string[];
    numUsedDCs: number;
    usedHosts: string[];
    numUsedHosts: number;
    numConnections: number;
};
const timeNextServer = 500;
const minTimeNextServerSameDC = 2000;
const timeToWaitForEarlyServerClose = 100;

type HostListEntry = {
    host: string;
    dc: string;
};
export type HostListEntryOptionalDC = {
    host: string;
    dc?: string;
};

// converts serialized hostlists and hostlists with undefined DCs to a proper format
export function convertToProperHostList(hostList: string | HostListEntryOptionalDC[]) {
    if (typeof hostList === "string") {
        return hostList
            .split(",")
            .filter(Boolean)
            .map((hostString) => {
                const [dc, host] = /\|/.test(hostString) ? hostString.split("|") : ["", hostString];
                return { host, dc };
            });
    }
    return hostList.filter((item) => item.host).map((item) => ({ host: item.host, dc: item.dc || "" }));
}
// responsible for checking and nominating (delivering) 1 working sfu websocket connection
// it will use a prioritized list of hosts to try
export function createVegaConnectionManager(config: {
    initialHostList: string | any[];
    getUrlForHost?: (host: string) => string;
    onConnected?: (vegaConnection: VegaConnection, info: ConnectionInfo) => void;
    onDisconnected?: () => void;
    onFailed?: () => void;
}) {
    let connectionInfo: ConnectionInfo;
    let lastDisconnectTime: number | undefined;
    let lastNetworkUpTime: number | undefined;
    let lastNetworkPossiblyDownTime: number | undefined;

    let hostList = [] as HostListEntry[];

    const updateHostList = (updatedHostList: string | HostListEntryOptionalDC[]) => {
        hostList = convertToProperHostList(updatedHostList);
    };

    let connectionAttemptInProgress = false;
    let hasPendingConnectionAttempt = false;

    // connect() will try all hosts maximum once. if one of the hosts get connected, the others will be aborted
    // if all fails and the onFailed is run, it is the callers responsibility to retry, maybe after a delay.
    // next time the list of host might be different.
    // if connect() is called after being previously connected, it will retry the same host it used to be
    // connected to, until network has been up for 3s, earliest 3s after the sfu disconnect
    // this way it should recover to the same server if network loss, which might not be detected yet (it can
    // lag 2s behind because of the noop probing on signal)
    const connect = () => {
        // do not allow parallell runs of this. If one or more runs are attempted while running, run it ONCE more after done
        if (connectionAttemptInProgress) {
            hasPendingConnectionAttempt = true;
            return;
        }
        connectionAttemptInProgress = true;
        hasPendingConnectionAttempt = false;

        // default to testing all hosts in hostlist
        let targetHostList = hostList;

        if (connectionInfo) {
            // but if we are reconnecting we might want to only try the last successful host
            const now = Date.now();
            const isLongEnoughSinceDisconnect = now - 3000 > (lastDisconnectTime || 0);
            const isNetworkUp = !lastNetworkPossiblyDownTime || (lastNetworkUpTime || 0) > lastNetworkPossiblyDownTime;
            const hasNetworkBeenUpLongEnough = isNetworkUp && now - 3000 > (lastNetworkUpTime || 0);

            if (!isLongEnoughSinceDisconnect || !hasNetworkBeenUpLongEnough) {
                // this is shortly after a disconnect and we're not sure if network is up
                // so we retry only the last successful host for now
                targetHostList = [{ host: connectionInfo.host, dc: connectionInfo.dc }];
            }
        }

        // create lookup for finding index of DC
        // purely for analytics purpose
        const dcIndexByDC = {} as Record<string, number>;
        let currentDCIndex = 0;
        targetHostList.forEach(({ dc }) => {
            if (typeof dcIndexByDC[dc] === "undefined") dcIndexByDC[dc] = currentDCIndex++;
        });

        let timeBeforeConnect = 0;
        const prevTimeBeforeConnectByDC = {} as Record<string, number>;
        let nominatedConnection: VegaConnection | undefined;
        let connectionsToResolve = targetHostList.length;
        let hasNotifiedDisconnect = false;
        let wasConnected = false;
        const beforeNetworkPossiblyDownTime = lastNetworkPossiblyDownTime;

        const handleFailedOrAbortedConnection = () => {
            connectionsToResolve--;
            if (connectionsToResolve === 0 && !hasNotifiedDisconnect) {
                connectionAttemptInProgress = false;
                if (hasPendingConnectionAttempt) {
                    // if we have a pending connect attempt we don't notify about this fail, we instead trigger a new attempt
                    setTimeout(connect, 0);
                } else {
                    config.onFailed?.();
                }
            }
        };

        const timers = [] as ReturnType<typeof setTimeout>[];

        // setup connection attempts for all hosts, with delays according to priority and DC
        // a new host might be tested before the previous is resolved, so multiple connections might exist in parallell
        // the first host that is connected will be used
        targetHostList.forEach(({ host, dc }, index) => {
            if (index > 0) {
                timeBeforeConnect += timeNextServer;
                const minTimeBeforeConnect = (prevTimeBeforeConnectByDC[dc] || 0) + minTimeNextServerSameDC;
                timeBeforeConnect = Math.max(timeBeforeConnect, minTimeBeforeConnect);
            }
            prevTimeBeforeConnectByDC[dc] = timeBeforeConnect;

            timers.push(
                setTimeout(() => {
                    timers.shift();

                    if (wasConnected) return;

                    if (beforeNetworkPossiblyDownTime !== lastNetworkPossiblyDownTime) {
                        // if network seemingly dropped after connect() started, drop any remaining scheduled host
                        // connection attempts so we can start trying the first/primary host again
                        handleFailedOrAbortedConnection();

                        // cancel pending connection attempts
                        timers.forEach((timeoutId) => {
                            clearTimeout(timeoutId);
                            // we might have one connection attempt in progress, that might actually connect
                            // so we only mark the pending attempts as aborted
                            handleFailedOrAbortedConnection();
                        });
                        return;
                    }

                    const vegaConnection = new VegaConnection(config.getUrlForHost?.(host) || host);
                    let wasClosed = false;

                    vegaConnection.on("open", () => {
                        // we are connected, but proxies or full/busy servers may close, so we wait a bit
                        setTimeout(() => {
                            if (wasClosed) return;
                            if (!nominatedConnection && !wasConnected) {
                                nominatedConnection = vegaConnection;
                                wasConnected = true;

                                const thisRoundFailedHosts = [
                                    ...new Set(
                                        targetHostList
                                            .slice(0, index)
                                            .filter((o) => o.host !== host)
                                            .map((o) => o.host),
                                    ),
                                ];
                                const thisRoundFailedDCs = [
                                    ...new Set(
                                        targetHostList
                                            .slice(0, index)
                                            .filter((o) => o.dc !== dc)
                                            .map((o) => o.dc),
                                    ),
                                ];
                                if (!connectionInfo) {
                                    connectionInfo = {
                                        host,
                                        dc,
                                        initialHost: host,
                                        initialDC: dc,
                                        initialHostIndex: index,
                                        initialDCIndex: dcIndexByDC[dc],
                                        failedHosts: thisRoundFailedHosts,
                                        failedDCs: thisRoundFailedDCs,
                                        usedHosts: [host],
                                        usedDCs: [dc],
                                        numConnections: 1,
                                        numUsedDCs: 1,
                                        numUsedHosts: 1,
                                        numFailedDCs: 0, // calculate this later
                                        numFailedHosts: 0, // calculate this later
                                    };
                                } else {
                                    connectionInfo = {
                                        ...connectionInfo,
                                        host,
                                        dc,
                                        failedHosts: [
                                            ...new Set([...thisRoundFailedHosts, ...connectionInfo.failedHosts]),
                                        ].filter(
                                            (failedHost) =>
                                                failedHost !== host && !connectionInfo.usedHosts.includes(failedHost),
                                        ),
                                        failedDCs: [
                                            ...new Set([...thisRoundFailedDCs, ...connectionInfo.failedDCs]),
                                        ].filter(
                                            (failedDC) => failedDC !== dc && !connectionInfo.usedDCs.includes(failedDC),
                                        ),
                                        usedHosts: [...new Set([...connectionInfo.usedHosts, host])],
                                        usedDCs: [...new Set([...connectionInfo.usedDCs, dc])],
                                        numConnections: connectionInfo.numConnections + 1,
                                    };
                                }
                                // update convenient props (posthog cannot query on length of set)
                                connectionInfo.numUsedDCs = connectionInfo.usedDCs.length;
                                connectionInfo.numUsedHosts = connectionInfo.usedHosts.length;
                                connectionInfo.numFailedDCs = connectionInfo.failedDCs.length;
                                connectionInfo.numFailedHosts = connectionInfo.failedHosts.length;

                                // if we have a pending connect() abort it as we're already connected
                                hasPendingConnectionAttempt = false;
                                connectionAttemptInProgress = false;

                                config.onConnected?.(vegaConnection, connectionInfo);
                            } else {
                                vegaConnection.close();
                            }
                        }, timeToWaitForEarlyServerClose);
                    });
                    vegaConnection.on("close", () => {
                        wasClosed = true;
                        if (vegaConnection === nominatedConnection) {
                            // the nominated connection was closed
                            nominatedConnection = undefined;
                            lastDisconnectTime = Date.now();
                            hasNotifiedDisconnect = true;
                            config.onDisconnected?.();
                        }
                        handleFailedOrAbortedConnection();
                    });
                }, timeBeforeConnect),
            );
        });
    };

    updateHostList(config.initialHostList);

    const networkIsUp = () => {
        lastNetworkUpTime = Math.max(Date.now(), lastNetworkUpTime || 0);
    };
    const networkIsPossiblyDown = () => {
        lastNetworkPossiblyDownTime = Date.now();
    };

    return { connect, updateHostList, networkIsUp, networkIsPossiblyDown };
}
