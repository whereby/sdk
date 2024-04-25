import * as React from "react";
import { Store, createServices, createStore } from "@whereby.com/core";

export interface ProviderProps {
    children: React.ReactNode;
}

const WherebyContext = React.createContext<Store | null>(null);

function Provider({ children }: ProviderProps) {
    const [store] = React.useState<Store>(() => {
        const services = createServices();
        return createStore({ injectServices: services });
    });

    return <WherebyContext.Provider value={store}>{children}</WherebyContext.Provider>;
}

export { Provider, WherebyContext };
