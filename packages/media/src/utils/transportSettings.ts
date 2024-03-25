export const maybeTurnOnly = (transportConfig: any, features: { useOnlyTURN: string }) => {
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
        transportConfig.iceServers = transportConfig.iceServers.filter(
            (entry: any) => entry.url && entry.url.match(filter)
        );
    }
};
