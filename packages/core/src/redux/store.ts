import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { listenerMiddleware } from "./listenerMiddleware";
import { createServices } from "../services";

import { appSlice, doAppStart } from "./slices/app";
import { authorizationSlice } from "./slices/authorization";
import { chatSlice } from "./slices/chat";
import { cloudRecordingSlice } from "./slices/cloudRecording";
import { connectionMonitorSlice } from "./slices/connectionMonitor";
import { deviceCredentialsSlice } from "./slices/deviceCredentials";
import { localMediaSlice } from "./slices/localMedia";
import { localParticipantSlice } from "./slices/localParticipant";
import { localScreenshareSlice } from "./slices/localScreenshare";
import { notificationsSlice } from "./slices/notifications";
import { organizationSlice } from "./slices/organization";
import { remoteParticipantsSlice } from "./slices/remoteParticipants";
import { roomSlice } from "./slices/room";
import { roomConnectionSlice } from "./slices/roomConnection";
import { signalConnectionSlice } from "./slices/signalConnection";
import { rtcAnalyticsSlice } from "./slices/rtcAnalytics";
import { rtcConnectionSlice } from "./slices/rtcConnection";
import { spotlightsSlice } from "./slices/spotlights";
import { streamingSlice } from "./slices/streaming";
import { waitingParticipantsSlice } from "./slices/waitingParticipants";

const IS_DEV = process.env.REACT_APP_IS_DEV === "true" ?? false;

const appReducer = combineReducers({
    app: appSlice.reducer,
    authorization: authorizationSlice.reducer,
    chat: chatSlice.reducer,
    cloudRecording: cloudRecordingSlice.reducer,
    connectionMonitor: connectionMonitorSlice.reducer,
    deviceCredentials: deviceCredentialsSlice.reducer,
    localMedia: localMediaSlice.reducer,
    localParticipant: localParticipantSlice.reducer,
    localScreenshare: localScreenshareSlice.reducer,
    notifications: notificationsSlice.reducer,
    organization: organizationSlice.reducer,
    remoteParticipants: remoteParticipantsSlice.reducer,
    room: roomSlice.reducer,
    roomConnection: roomConnectionSlice.reducer,
    rtcAnalytics: rtcAnalyticsSlice.reducer,
    rtcConnection: rtcConnectionSlice.reducer,
    signalConnection: signalConnectionSlice.reducer,
    spotlights: spotlightsSlice.reducer,
    streaming: streamingSlice.reducer,
    waitingParticipants: waitingParticipantsSlice.reducer,
});

export const rootReducer: AppReducer = (state, action) => {
    // Reset store state on app join action
    if (doAppStart.match(action)) {
        const resetState: Partial<RootState> = {
            app: {
                ...appSlice.getInitialState(),
                initialConfig: state?.app?.initialConfig,
            },
            localMedia: {
                ...localMediaSlice.getInitialState(),
                ...state?.localMedia,
            },
        };

        return appReducer(resetState, action);
    }

    return appReducer(state, action);
};

export const createStore = ({
    preloadedState,
    injectServices,
}: {
    preloadedState?: Partial<RootState>;
    injectServices: ReturnType<typeof createServices>;
}) => {
    return configureStore({
        devTools: IS_DEV,
        reducer: rootReducer,
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({
                thunk: {
                    extraArgument: { services: injectServices },
                },
                serializableCheck: false,
            }).prepend(listenerMiddleware.middleware),
        preloadedState,
    });
};

export type AppReducer = typeof appReducer;
export type RootState = ReturnType<typeof appReducer>;
export type AppDispatch = ReturnType<typeof createStore>["dispatch"];

export type Store = ReturnType<typeof createStore>;

export const observeStore = <T>(store: Store, select: (state: RootState) => T, onChange: (result: T) => void) => {
    let currentState: T;

    function handleChange() {
        const nextState = select(store.getState());
        if (nextState !== currentState) {
            currentState = nextState;
            onChange(currentState);
        }
    }

    const unsubscribe = store.subscribe(handleChange);
    handleChange();
    return unsubscribe;
};
