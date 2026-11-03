import * as React from "react";
import { WherebyClient } from "@whereby.com/core";

export const WherebyContext = React.createContext<WherebyClient | null>(null);
export interface ProviderProps {
    children: React.ReactNode;
    /**
     * A `WherebyClient` created outside React, for apps that keep logic outside components (for example in a Redux
     * store) and need to call the SDK or subscribe to its events from there.
     *
     * The caller owns this client: the provider uses it but never calls `destroy()` on it. Call `destroy()` yourself
     * when you no longer need it.
     *
     * When omitted, the provider creates its own client and destroys it on unmount.
     */
    client?: WherebyClient;
}

function Provider({ children, client: externalClient }: ProviderProps) {
    const client = React.useMemo(() => externalClient ?? new WherebyClient(), [externalClient]);
    const ownsClient = !externalClient;

    React.useEffect(() => {
        if (!ownsClient) {
            return;
        }
        return () => {
            client.destroy();
        };
    }, [client, ownsClient]);

    return <WherebyContext.Provider value={client}>{children}</WherebyContext.Provider>;
}

export { Provider };
