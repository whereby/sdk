import {
    fileShareSlice,
    fileShareSliceInitialState,
    fileUploadsStarted,
    fileShareRequestSettled,
    fileUploadSucceeded,
    fileUploadFailed,
    clearFileUploads,
    selectFileUploads,
    selectFileShareRequestInFlight,
    FileUpload,
} from "../fileShare";
import { RootState } from "../../store";

const upload = (id: string, overrides: Partial<FileUpload> = {}): FileUpload => ({
    id,
    name: `${id}.txt`,
    size: 10,
    type: "text/plain",
    status: "uploading",
    ...overrides,
});

describe("fileShareSlice", () => {
    describe("reducers", () => {
        it("fileUploadsStarted adds uploads and flags a request in flight", () => {
            const result = fileShareSlice.reducer(
                fileShareSliceInitialState,
                fileUploadsStarted([upload("a"), upload("b")]),
            );

            expect(result.requestInFlight).toBe(true);
            expect(result.uploads.map((u) => u.id)).toEqual(["a", "b"]);
        });

        it("fileShareRequestSettled clears the in-flight flag", () => {
            const started = fileShareSlice.reducer(fileShareSliceInitialState, fileUploadsStarted([upload("a")]));

            const result = fileShareSlice.reducer(started, fileShareRequestSettled());

            expect(result.requestInFlight).toBe(false);
            expect(result.uploads).toHaveLength(1);
        });

        it("fileUploadSucceeded marks the matching upload sent", () => {
            const started = fileShareSlice.reducer(fileShareSliceInitialState, fileUploadsStarted([upload("a")]));

            const result = fileShareSlice.reducer(started, fileUploadSucceeded({ id: "a" }));

            expect(result.uploads[0].status).toBe("sent");
        });

        it("fileUploadFailed records the error reason", () => {
            const started = fileShareSlice.reducer(fileShareSliceInitialState, fileUploadsStarted([upload("a")]));

            const result = fileShareSlice.reducer(
                started,
                fileUploadFailed({ id: "a", error: "file_sharing_not_enabled" }),
            );

            expect(result.uploads[0]).toMatchObject({ status: "error", error: "file_sharing_not_enabled" });
        });

        it("clearFileUploads empties the list", () => {
            const started = fileShareSlice.reducer(
                fileShareSliceInitialState,
                fileUploadsStarted([upload("a"), upload("b")]),
            );

            const result = fileShareSlice.reducer(started, clearFileUploads());

            expect(result.uploads).toEqual([]);
        });
    });

    describe("selectors", () => {
        it("expose uploads and the in-flight flag", () => {
            const state = {
                fileShare: { uploads: [upload("a", { status: "sent" })], requestInFlight: true },
            } as unknown as RootState;

            expect(selectFileUploads(state)).toHaveLength(1);
            expect(selectFileShareRequestInFlight(state)).toBe(true);
        });
    });
});
