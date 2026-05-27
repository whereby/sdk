import { createStore, mockSignalEmit } from "../store.setup";
import { doSendChatMessage, doRemoveChatMessage } from "../../slices/chat";

describe("actions", () => {
    it("doSendChatMessage", () => {
        const store = createStore({ withSignalConnection: true, connectToRoom: true });

        store.dispatch(doSendChatMessage({ text: "text" }));

        expect(mockSignalEmit).toHaveBeenCalledWith("chat_message", { text: "text" });
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
