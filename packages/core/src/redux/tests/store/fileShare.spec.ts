import { createStore, mockSignalEmit } from "../store.setup";
import { doSendFiles, doDownloadFile, MAX_FILES_PER_UPLOAD, MAX_FILE_SIZE } from "../../slices/fileShare";
import { signalEvents } from "../../slices/signalConnection/actions";

describe("fileShare actions", () => {
    describe("doSendFiles", () => {
        it("requests upload urls, uploads to S3 and shares each file as a chat message", async () => {
            const store = createStore({ withSignalConnection: true, connectToRoom: true });
            global.fetch = jest.fn().mockResolvedValue({ ok: true });

            mockSignalEmit.mockImplementation((event: string, _payload: unknown, ack?: (urls: unknown) => void) => {
                if (event === "request_file_upload_url" && ack) {
                    ack([
                        {
                            downloadUrl: "https://dl/a",
                            uploadUrl: { url: "https://s3", fields: { key: "key-a" } },
                        },
                    ]);
                }
            });

            const file = new File(["abc"], "a.txt", { type: "text/plain" });

            await store.dispatch(doSendFiles({ files: [file] }));

            expect(mockSignalEmit).toHaveBeenCalledWith(
                "request_file_upload_url",
                { files: [{ name: "a.txt", size: 3, type: "text/plain" }] },
                expect.any(Function),
            );
            expect(global.fetch).toHaveBeenCalledWith("https://s3", expect.objectContaining({ method: "POST" }));
            expect(mockSignalEmit).toHaveBeenCalledWith("chat_message", {
                text: "",
                file: {
                    downloadUrl: "https://dl/a",
                    name: "a.txt",
                    size: 3,
                    type: "text/plain",
                    key: "key-a",
                },
            });

            const uploads = store.getState().fileShare.uploads;
            expect(uploads).toHaveLength(1);
            expect(uploads[0].status).toBe("sent");
            expect(store.getState().fileShare.requestInFlight).toBe(false);
        });

        it("fails the whole batch when the server rejects the request", async () => {
            const store = createStore({ withSignalConnection: true, connectToRoom: true });
            global.fetch = jest.fn().mockResolvedValue({ ok: true });

            mockSignalEmit.mockImplementation((event: string) => {
                if (event === "request_file_upload_url") {
                    store.dispatch(signalEvents.fileSharingError({ error: "file_sharing_not_available" }));
                }
            });

            const files = [
                new File(["abc"], "a.txt", { type: "text/plain" }),
                new File(["defgh"], "b.txt", { type: "text/plain" }),
            ];

            await store.dispatch(doSendFiles({ files }));

            const uploads = store.getState().fileShare.uploads;
            expect(uploads.map((u) => u.status)).toEqual(["error", "error"]);
            expect(uploads.every((u) => u.error === "file_sharing_not_available")).toBe(true);
            expect(global.fetch).not.toHaveBeenCalled();
            expect(mockSignalEmit).not.toHaveBeenCalledWith("chat_message", expect.anything());
            expect(store.getState().fileShare.requestInFlight).toBe(false);
        });

        it(`fails the whole batch with too_many_files when more than ${MAX_FILES_PER_UPLOAD} files are shared`, async () => {
            const store = createStore({ withSignalConnection: true, connectToRoom: true });
            global.fetch = jest.fn().mockResolvedValue({ ok: true });

            const files = Array.from(
                { length: MAX_FILES_PER_UPLOAD + 1 },
                (_, i) => new File(["x"], `file-${i}.txt`, { type: "text/plain" }),
            );

            await store.dispatch(doSendFiles({ files }));

            const uploads = store.getState().fileShare.uploads;
            expect(uploads).toHaveLength(MAX_FILES_PER_UPLOAD + 1);
            expect(uploads.every((u) => u.status === "error" && u.error === "too_many_files")).toBe(true);
            expect(mockSignalEmit).not.toHaveBeenCalled();
            expect(global.fetch).not.toHaveBeenCalled();
            expect(store.getState().fileShare.requestInFlight).toBe(false);
        });

        it("rejects unsupported types and oversized files but uploads the valid rest", async () => {
            const store = createStore({ withSignalConnection: true, connectToRoom: true });
            global.fetch = jest.fn().mockResolvedValue({ ok: true });

            mockSignalEmit.mockImplementation((event: string, _payload: unknown, ack?: (urls: unknown) => void) => {
                if (event === "request_file_upload_url" && ack) {
                    ack([{ downloadUrl: "https://dl/ok", uploadUrl: { url: "https://s3", fields: { key: "k" } } }]);
                }
            });

            const ok = new File(["abc"], "ok.png", { type: "image/png" });
            const wrongType = new File(["abc"], "bad.exe", { type: "application/x-msdownload" });
            const tooBig = new File([new Uint8Array(MAX_FILE_SIZE + 1)], "huge.png", { type: "image/png" });

            await store.dispatch(doSendFiles({ files: [ok, wrongType, tooBig] }));

            const uploads = store.getState().fileShare.uploads;
            expect(uploads.find((u) => u.name === "ok.png")).toMatchObject({ status: "sent" });
            expect(uploads.find((u) => u.name === "bad.exe")).toMatchObject({
                status: "error",
                error: "unsupported_file_type",
            });
            expect(uploads.find((u) => u.name === "huge.png")).toMatchObject({
                status: "error",
                error: "file_too_large",
            });

            expect(mockSignalEmit).toHaveBeenCalledWith(
                "request_file_upload_url",
                { files: [{ name: "ok.png", size: 3, type: "image/png" }] },
                expect.any(Function),
            );
            expect(mockSignalEmit).toHaveBeenCalledWith(
                "chat_message",
                expect.objectContaining({
                    file: expect.objectContaining({ name: "ok.png" }),
                }),
            );
            expect(store.getState().fileShare.requestInFlight).toBe(false);
        });

        it("marks an upload failed when the S3 upload fails", async () => {
            const store = createStore({ withSignalConnection: true, connectToRoom: true });
            global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });

            mockSignalEmit.mockImplementation((event: string, _payload: unknown, ack?: (urls: unknown) => void) => {
                if (event === "request_file_upload_url" && ack) {
                    ack([{ downloadUrl: "https://dl/a", uploadUrl: { url: "https://s3", fields: { key: "k" } } }]);
                }
            });

            await store.dispatch(doSendFiles({ files: [new File(["abc"], "a.txt", { type: "text/plain" })] }));

            const uploads = store.getState().fileShare.uploads;
            expect(uploads[0]).toMatchObject({ status: "error", error: "upload_failed" });
            expect(mockSignalEmit).not.toHaveBeenCalledWith("chat_message", expect.anything());
        });
    });

    describe("doDownloadFile", () => {
        it("returns the downloaded blob", async () => {
            const store = createStore();
            const blob = new Blob(["file-contents"]);
            global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });

            const file = {
                downloadUrl: "https://dl/a",
                name: "a.txt",
                size: 3,
                type: "text/plain",
                key: "k",
            };

            const result = await store.dispatch(doDownloadFile({ file })).unwrap();

            expect(global.fetch).toHaveBeenCalledWith("https://dl/a", { mode: "cors", cache: "no-cache" });
            expect(result).toBe(blob);
        });
    });
});
