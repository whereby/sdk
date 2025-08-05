import * as React from "react";
import { WherebyClient } from "@whereby.com/core";

export const WherebyContext = React.createContext<WherebyClient | null>(null);
export interface ProviderProps {
    children: React.ReactNode;
}

function Provider({ children }: ProviderProps) {
    const client = React.useMemo(() => new WherebyClient(), []);

    React.useEffect(() => {
        return () => {
            client.destroy();
        };
    }, [client]);

    return <WherebyContext.Provider value={client}>{children}</WherebyContext.Provider>;
}

export { Provider };
