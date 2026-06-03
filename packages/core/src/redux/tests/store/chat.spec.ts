import { createStore, mockSignalEmit } from "../store.setup";
import { doSendChatMessage, doRemoveChatMessage } from "../../slices/chat";

describe("actions", () => {
    describe("doSendChatMessage", () => {
        it("should send chat message", () => {
            const store = createStore({ withSignalConnection: true, connectToRoom: true });

            store.dispatch(doSendChatMessage({ text: "text" }));

            expect(mockSignalEmit).toHaveBeenCalledWith("chat_message", { text: "text" });
        });

        it("should send chat message with parent id if provided", () => {
            const store = createStore({ withSignalConnection: true, connectToRoom: true });

            store.dispatch(doSendChatMessage({ text: "text", parentId: "parent-id" }));

            expect(mockSignalEmit).toHaveBeenCalledWith("chat_message", { text: "text", parentId: "parent-id" });
        });
    });

    describe("doRemoveChatMessage", () => {
        it("with author signature", () => {
            const store = createStore({ withSignalConnection: true, connectToRoom: true });

            store.dispatch(doRemoveChatMessage({ id: "test-id1", sig: "test-sig" }));

            expect(mockSignalEmit).toHaveBeenCalledWith("remove_chat_message", { id: "test-id1", sig: "test-sig" });
        });

        it("without author signature", () => {
            const store = createStore({ withSignalConnection: true, connectToRoom: true });

            store.dispatch(doRemoveChatMessage({ id: "test-id2", sig: null }));

            expect(mockSignalEmit).toHaveBeenCalledWith("remove_chat_message", { id: "test-id2", sig: null });
        });
    });
});
