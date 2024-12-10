import { RootState } from "../../store";
/**
 * Selectors
 */

export const selectRoomConnectionRaw = (state: RootState) => state.roomConnection;
export const selectRoomConnectionSession = (state: RootState) => state.roomConnection.session;
export const selectRoomConnectionSessionId = (state: RootState) => state.roomConnection.session?.id;
export const selectRoomConnectionStatus = (state: RootState) => state.roomConnection.status;
export const selectRoomConnectionError = (state: RootState) => state.roomConnection.error;
