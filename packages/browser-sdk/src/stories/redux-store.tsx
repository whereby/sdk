import * as React from "react";

import { createSlice, configureStore } from "@reduxjs/toolkit";
import { Provider as ReduxProvider } from "react-redux";

const counterSlice = createSlice({
    name: "counter",
    initialState: {
        value: 0,
    },
    reducers: {
        incremented: (state) => {
            state.value += 1;
        },
        decremented: (state) => {
            state.value -= 1;
        },
    },
});

export const { incremented, decremented } = counterSlice.actions;

export const selectCount = (state: RootState) => state.value;

const store = configureStore({
    reducer: counterSlice.reducer,
});

type RootState = ReturnType<typeof store.getState>;

const Provider = ({ children }: { children: React.ReactNode }) => {
    return <ReduxProvider store={store}>{children}</ReduxProvider>;
};

export { Provider };
