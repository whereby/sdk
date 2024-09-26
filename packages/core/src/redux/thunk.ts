import { createAsyncThunk, AsyncThunk, AsyncThunkPayloadCreator } from "@reduxjs/toolkit";
import { RootState, AppDispatch } from "./store";
import { createServices } from "../services";

export type ThunkConfig = {
    state: RootState;
    dispatch: AppDispatch;
    extra: { services: ReturnType<typeof createServices> };
};

export function createAppAsyncThunk<ReturnType, ArgType = undefined>(
    typePrefix: string,
    payloadCreator: AsyncThunkPayloadCreator<ReturnType, ArgType, ThunkConfig>,
): AsyncThunk<ReturnType, ArgType, ThunkConfig> {
    return createAsyncThunk<ReturnType, ArgType, ThunkConfig>(typePrefix, payloadCreator);
}

export type AppThunk<R = void> = (
    dispatch: AppDispatch,
    getState: () => RootState,
    extra: { services: ReturnType<typeof createServices> },
) => R;

export function createAppThunk<A = void>(thunk: (args: A) => AppThunk) {
    return thunk;
}

export function createAppAuthorizedThunk<A = void>(
    authorizationSelector: (state: RootState) => boolean,
    thunk: (args: A) => AppThunk,
) {
    return createAppThunk((payload: A) => (dispatch, getState, extra) => {
        const isAuthorized: boolean = authorizationSelector(getState());

        if (!isAuthorized) {
            console.warn("Not authorized to perform this action");
            return false;
        }

        return thunk(payload)(dispatch, getState, extra);
    });
}

export function createRoomConnectedThunk<A = void>(thunk: (args: A) => AppThunk) {
    return createAppThunk((payload: A) => (dispatch, getState, extra) => {
        const connectionStatus = getState().roomConnection.status;

        if (connectionStatus !== "connected") {
            console.warn("Action cannot be performed outside of a connected room");
            return false;
        }

        return thunk(payload)(dispatch, getState, extra);
    });
}

export function createAsyncRoomConnectedThunk<ReturnType, ArgType = undefined>(
    typePrefix: string,
    payloadCreator: AsyncThunkPayloadCreator<ReturnType, ArgType, ThunkConfig>,
) {
    return createAppAsyncThunk<ReturnType, ArgType>(typePrefix, (arg, thunkApi) => {
        const { getState } = thunkApi;
        const connectionStatus = getState().roomConnection.status;

        if (connectionStatus !== "connected") {
            console.warn("Action cannot be performed outside of a connected room");
            return Promise.reject("Action cannot be performed outside of a connected room");
        }

        return payloadCreator(arg, thunkApi);
    });
}

export function createAuthorizedRoomConnectedThunk<A = void>(
    authorizationSelector: (state: RootState) => boolean,
    thunk: (args: A) => AppThunk,
) {
    return createAppThunk((payload: A) => (dispatch, getState, extra) => {
        const connectionStatus = getState().roomConnection.status;

        if (connectionStatus !== "connected") {
            console.warn("Action cannot be performed outside of a connected room");
            return false;
        }

        return createAppAuthorizedThunk(authorizationSelector, thunk)(payload)(dispatch, getState, extra);
    });
}
