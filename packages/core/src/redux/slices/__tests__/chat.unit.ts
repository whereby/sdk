import { chatSlice } from "../chat";
import { signalEvents } from "../signalConnection/actions";

describe("chatSlice", () => {
    describe("reducers", () => {
        it("signalEvents.chatMessage", () => {
            const result = chatSlice.reducer(
                undefined,
                signalEvents.chatMessage({
                    id: "messageId",
                    userId: "userId",
                    senderId: "senderId",
                    parentId: "parentId",
                    messageType: "text",
                    roomName: "roomName",
                    sig: "sig",
                    timestamp: "123",
                    text: "text",
                }),
            );

            expect(result.chatMessages).toEqual([
                {
                    id: "messageId",
                    senderId: "senderId",
                    parentId: "parentId",
                    timestamp: "123",
                    text: "text",
                    sig: "sig",
                    removed: false,
                },
            ]);
        });

        it("signalEvents.chatMessage with a file", () => {
            const file = {
                downloadUrl: "https://example.com/download",
                name: "report.pdf",
                size: 1234,
                type: "application/pdf",
                key: "uploads/report.pdf",
            };

            const result = chatSlice.reducer(
                undefined,
                signalEvents.chatMessage({
                    id: "messageId",
                    userId: "userId",
                    senderId: "senderId",
                    messageType: "text",
                    roomName: "roomName",
                    sig: "sig",
                    timestamp: "123",
                    text: "",
                    file,
                }),
            );

            expect(result.chatMessages).toEqual([
                {
                    id: "messageId",
                    senderId: "senderId",
                    timestamp: "123",
                    text: "",
                    sig: "sig",
                    removed: false,
                    file,
                },
            ]);
        });
    });
});
