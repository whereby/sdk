import * as React from "react";
import { Provider as ReduxProvider } from "react-redux";
import { createServices, createStore } from "@whereby.com/core";

export interface ProviderProps {
    children: React.ReactNode;
}

function Provider({ children }: ProviderProps) {
    const services = createServices();
    const store = createStore({ injectServices: services });

    return <ReduxProvider store={store}>{children}</ReduxProvider>;
}

export { Provider };
