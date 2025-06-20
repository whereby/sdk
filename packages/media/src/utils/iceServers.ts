import { TransportOptions } from "mediasoup-client/lib/types";

export const maybeTurnOnly = (iceConfig: TransportOptions, features: { useOnlyTURN?: string }) => {
    if (!features.useOnlyTURN) {
        return;
    }

    iceConfig.iceTransportPolicy = "relay";

    // if value is more specific we can filter ICE server list based on protocol (udp/tcp/tls)
    const filter = {
        onlyudp: /^turn:.*transport=udp$/,
        onlytcp: /^turn:.*transport=tcp$/,
        onlytls: /^turns:.*transport=tcp$/,
    }[features.useOnlyTURN];

    if (filter) {
        iceConfig.iceServers = iceConfig.iceServers!.filter((entry: any) => {
            if (entry.url && entry.url.match(filter)) return entry;
            if (entry.urls) {
                entry.urls = (entry.urls.some ? entry.urls : [entry.urls]).filter((url: any) => url.match(filter));
                if (entry.urls.length > 0) return entry;
            }
        });
    }
};

export const external_stun_servers = (
    iceConfig: any,
    features: { addGoogleStunServers?: boolean; addCloudflareStunServers?: boolean },
) => {
    if (features.addGoogleStunServers) {
        iceConfig.iceServers = [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            ...iceConfig.iceServers,
        ];
    }
    if (features.addCloudflareStunServers) {
        iceConfig.iceServers = [
            { urls: "stun:stun.cloudflare.com:3478" },
            { urls: "stun:stun.cloudflare.com:53" },
            ...iceConfig.iceServers,
        ];
    }
};

export const turnServerOverride = (iceServers: any, overrideHost: any) => {
    if (overrideHost && iceServers) {
        const host = overrideHost;
        const port = host.indexOf(":") > 0 ? "" : ":443";
        const override = ":" + host + port;
        return iceServers.map((original: any) => {
            const entry = Object.assign({}, original);
            if (entry.url) {
                entry.url = entry.url.replace(/:[^?]*/, override);
            }
            if (entry.urls) {
                entry.urls = entry.urls.map((url: string) => url.replace(/:[^?]*/, override));
            }
            return entry;
        });
    } else {
        return iceServers;
    }
};
