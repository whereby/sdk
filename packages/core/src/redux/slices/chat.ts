import { createSlice } from "@reduxjs/toolkit";
import { ChatFileShare, ChatMessage as SignalChatMessage } from "@whereby.com/media";
import { RootState } from "../store";
import { createRoomConnectedThunk } from "../thunk";
import { signalEvents } from "./signalConnection/actions";
import { selectSignalConnectionRaw } from "./signalConnection";
import { selectBreakoutCurrentId } from "./breakout";

export type ChatMessage = Pick<SignalChatMessage, "id" | "senderId" | "parentId" | "timestamp" | "text" | "sig"> & {
    removed: boolean;
    file?: ChatFileShare;
};

/**
 * Reducer
 */
export interface ChatState {
    chatMessages: ChatMessage[];
}

export const chatSliceInitialState: ChatState = {
    chatMessages: [],
};

export const chatSlice = createSlice({
    name: "chat",
    initialState: chatSliceInitialState,
    reducers: {},
    extraReducers(builder) {
        builder.addCase(signalEvents.chatMessage, (state, action) => {
            const message: ChatMessage = {
                id: action.payload.id,
                senderId: action.payload.senderId,
                parentId: action.payload.parentId,
                timestamp: action.payload.timestamp,
                text: action.payload.text,
                sig: action.payload.sig,
                removed: false,
                ...(action.payload.file && { file: action.payload.file }),
            };

            return {
                ...state,
                chatMessages: [...state.chatMessages, message],
            };
        });
        builder.addCase(signalEvents.chatMessageRemoved, (state, action) => {
            return {
                ...state,
                chatMessages: state.chatMessages.map((m) => {
                    return {
                        ...m,
                        ...(m.id === action.payload.id && {
                            removed: true,
                        }),
                    };
                }),
            };
        });
    },
});

/**
 * Action creators
 */
export const doSendChatMessage = createRoomConnectedThunk(
    (payload: { text: string; isBroadcast?: boolean; parentId?: string }) => (_, getState) => {
        const state = getState();
        const socket = selectSignalConnectionRaw(state).socket;
        const breakoutCurrentId = selectBreakoutCurrentId(state);

        socket?.emit("chat_message", {
            text: payload.text,
            ...(payload.parentId && { parentId: payload.parentId }),
            ...(breakoutCurrentId && { breakoutGroup: breakoutCurrentId }),
            ...(payload.isBroadcast && { broadcast: true }),
        });
    },
);

export const doRemoveChatMessage = createRoomConnectedThunk(
    ({ id, sig }: Pick<SignalChatMessage, "id" | "sig">) =>
        (_, getState) => {
            const state = getState();
            const socket = selectSignalConnectionRaw(state).socket;

            socket?.emit("remove_chat_message", {
                id,
                sig,
            });
        },
);

/**
 * Selectors
 */
export const selectChatRaw = (state: RootState) => state.chat;
export const selectChatMessages = (state: RootState) => state.chat.chatMessages;
