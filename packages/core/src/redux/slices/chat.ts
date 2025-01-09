import { createSlice } from "@reduxjs/toolkit";
import { ChatMessage as SignalChatMessage } from "@whereby.com/media";
import { RootState } from "../store";
import { createRoomConnectedThunk } from "../thunk";
import { signalEvents } from "./signalConnection/actions";
import { selectSignalConnectionRaw } from "./signalConnection";
import { selectBreakoutCurrentId } from "./breakout";

export type ChatMessage = Pick<SignalChatMessage, "senderId" | "timestamp" | "text">;

/**
 * Reducer
 */
export interface ChatState {
    chatMessages: ChatMessage[];
}

const initialState: ChatState = {
    chatMessages: [],
};

export const chatSlice = createSlice({
    name: "chat",
    initialState,
    reducers: {},
    extraReducers(builder) {
        builder.addCase(signalEvents.chatMessage, (state, action) => {
            const message: ChatMessage = {
                senderId: action.payload.senderId,
                timestamp: action.payload.timestamp,
                text: action.payload.text,
            };

            return {
                ...state,
                chatMessages: [...state.chatMessages, message],
            };
        });
    },
});

/**
 * Action creators
 */
export const doSendChatMessage = createRoomConnectedThunk(
    (payload: { text: string; isBroadcast?: boolean }) => (_, getState) => {
        const state = getState();
        const socket = selectSignalConnectionRaw(state).socket;
        const breakoutCurrentId = selectBreakoutCurrentId(state);

        socket?.emit("chat_message", {
            text: payload.text,
            ...(breakoutCurrentId && { breakoutGroup: breakoutCurrentId }),
            ...(payload.isBroadcast && { broadcast: true }),
        });
    },
);

/**
 * Selectors
 */
export const selectChatRaw = (state: RootState) => state.chat;
export const selectChatMessages = (state: RootState) => state.chat.chatMessages;
