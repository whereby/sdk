export const maybeTurnOnly = (transportConfig, features) => {
    if (!features.useOnlyTURN) {
        return;
    }

    transportConfig.iceTransportPolicy = "relay";

    // if value is more specific we can filter ICE server list based on protocol (udp/tcp/tls)
    const filter = {
        onlyudp: /^turn:.*transport=udp$/,
        onlytcp: /^turn:.*transport=tcp$/,
        onlytls: /^turns:.*transport=tcp$/,
    }[features.useOnlyTURN];

    if (filter) {
        transportConfig.iceServers = transportConfig.iceServers.filter((entry) => entry.url && entry.url.match(filter));
    }
};
