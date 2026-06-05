import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";
import { ChatFileShare, FileShareErrorCode, FileUploadUrl } from "@whereby.com/media";

import { RootState } from "../store";
import { createAppAsyncThunk, createAsyncRoomConnectedThunk } from "../thunk";
import { addAppListener } from "../listenerMiddleware";
import { signalEvents } from "./signalConnection/actions";
import { selectSignalConnectionRaw } from "./signalConnection";
import { selectBreakoutCurrentId } from "./breakout";

export type FileShareError = FileShareErrorCode | "upload_failed";

export interface FileUpload {
    id: string;
    name: string;
    size: number;
    type: string;
    status: "uploading" | "sent" | "error";
    error?: FileShareError;
}

/**
 * Reducer
 */
export interface FileShareState {
    uploads: FileUpload[];
    requestInFlight: boolean;
}

export const fileShareSliceInitialState: FileShareState = {
    uploads: [],
    requestInFlight: false,
};

export const fileShareSlice = createSlice({
    name: "fileShare",
    initialState: fileShareSliceInitialState,
    reducers: {
        fileUploadsStarted: (state, action: PayloadAction<FileUpload[]>) => {
            state.uploads.push(...action.payload);
            state.requestInFlight = true;
        },
        fileShareRequestSettled: (state) => {
            state.requestInFlight = false;
        },
        fileUploadSucceeded: (state, action: PayloadAction<{ id: string }>) => {
            const upload = state.uploads.find((u) => u.id === action.payload.id);
            if (upload) {
                upload.status = "sent";
            }
        },
        fileUploadFailed: (state, action: PayloadAction<{ id: string; error: FileShareError }>) => {
            const upload = state.uploads.find((u) => u.id === action.payload.id);
            if (upload) {
                upload.status = "error";
                upload.error = action.payload.error;
            }
        },
        clearFileUploads: (state) => {
            state.uploads = [];
        },
    },
});

export const { fileUploadsStarted, fileShareRequestSettled, fileUploadSucceeded, fileUploadFailed, clearFileUploads } =
    fileShareSlice.actions;

/**
 * Action creators
 */

type RequestOutcome = { urls: FileUploadUrl[] } | { error: FileShareErrorCode };

function uploadFile(file: File, uploadUrl: FileUploadUrl["uploadUrl"]) {
    const form = new FormData();
    form.append("Content-Type", file.type);
    Object.entries(uploadUrl.fields).forEach(([key, value]) => form.append(key, value));
    form.append("file", file);

    return fetch(uploadUrl.url, { method: "POST", body: form });
}

export const doSendFiles = createAsyncRoomConnectedThunk(
    "fileShare/sendFiles",
    async (payload: { files: File[] }, { dispatch, getState }) => {
        const state = getState();

        if (state.fileShare.requestInFlight) {
            return Promise.reject(new Error("A file upload request is already in flight"));
        }

        const socket = selectSignalConnectionRaw(state).socket;
        if (!socket) {
            return Promise.reject(new Error("No signal connection"));
        }

        const breakoutCurrentId = selectBreakoutCurrentId(state);
        const { files } = payload;

        if (!files.length) {
            return;
        }

        const uploads: FileUpload[] = files.map((file) => ({
            id: uuidv4(),
            name: file.name,
            size: file.size,
            type: file.type,
            status: "uploading",
        }));

        dispatch(fileUploadsStarted(uploads));

        const outcome = await new Promise<RequestOutcome>((resolve) => {
            let settled = false;

            const removeListener = dispatch(
                addAppListener({
                    actionCreator: signalEvents.fileSharingError,
                    effect: (action, listenerApi) => {
                        if (settled) return;
                        settled = true;
                        listenerApi.unsubscribe();
                        resolve({ error: action.payload.error });
                    },
                }),
            );

            socket.emit(
                "request_file_upload_url",
                { files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })) },
                (urls: FileUploadUrl[]) => {
                    if (settled) return;
                    settled = true;
                    removeListener({ cancelActive: true });
                    resolve({ urls });
                },
            );
        });

        dispatch(fileShareRequestSettled());

        if ("error" in outcome) {
            uploads.forEach((upload) => dispatch(fileUploadFailed({ id: upload.id, error: outcome.error })));
            return;
        }

        await Promise.all(
            uploads.map(async (upload, index) => {
                const file = files[index];
                const urls = outcome.urls[index];

                if (!urls) {
                    dispatch(fileUploadFailed({ id: upload.id, error: "upload_failed" }));
                    return;
                }

                try {
                    const response = await uploadFile(file, urls.uploadUrl);
                    if (!response.ok) {
                        throw new Error(`S3 upload failed with status ${response.status}`);
                    }

                    socket.emit("chat_message", {
                        text: "",
                        file: {
                            downloadUrl: urls.downloadUrl,
                            name: file.name,
                            size: file.size,
                            type: file.type,
                            key: urls.uploadUrl.fields.key,
                        },
                        ...(breakoutCurrentId && { breakoutGroup: breakoutCurrentId }),
                    });

                    dispatch(fileUploadSucceeded({ id: upload.id }));
                } catch {
                    dispatch(fileUploadFailed({ id: upload.id, error: "upload_failed" }));
                }
            }),
        );
    },
);

export const doDownloadFile = createAppAsyncThunk(
    "fileShare/downloadFile",
    async (payload: { file: ChatFileShare }) => {
        const response = await fetch(payload.file.downloadUrl, { mode: "cors", cache: "no-cache" });
        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.status}`);
        }
        return response.blob();
    },
);

/**
 * Selectors
 */
export const selectFileShareRaw = (state: RootState) => state.fileShare;
export const selectFileUploads = (state: RootState) => state.fileShare.uploads;
export const selectFileShareRequestInFlight = (state: RootState) => state.fileShare.requestInFlight;
