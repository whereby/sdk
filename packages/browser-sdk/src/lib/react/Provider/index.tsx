import * as React from "react";
import {
    Provider as ReduxProvider,
    createStoreHook,
    createDispatchHook,
    createSelectorHook,
    ReactReduxContextValue,
} from "react-redux";
import { createServices, createStore } from "@whereby.com/core";
import { Action } from "@reduxjs/toolkit";

const WherebyContext = React.createContext<ReactReduxContextValue<unknown, Action> | null>(null);

export const useStore = createStoreHook(WherebyContext);
export const useDispatch = createDispatchHook(WherebyContext);
export const useSelector = createSelectorHook(WherebyContext);

export interface ProviderProps {
    children: React.ReactNode;
}

function Provider({ children }: ProviderProps) {
    const services = createServices();
    const store = createStore({ injectServices: services });

    return (
        <ReduxProvider context={WherebyContext} store={store}>
            {children}
        </ReduxProvider>
    );
}

export { Provider };
