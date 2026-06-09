import { LiveCaptionEvent } from "@whereby.com/media";
import { liveCaptionsSlice, initialLiveCaptionsState } from "../liveCaptions";
import { signalEvents } from "../signalConnection/actions";
import LiveCaption from "../../../api/models/LiveCaption";

describe("liveCaptionsSlice", () => {
    describe("reducers", () => {
        describe("signalEvents.liveCaptionsStarted", () => {
            describe("if initiation succeeds", () => {
                it("sets the status to 'captioning'", () => {
                    const result = liveCaptionsSlice.reducer(undefined, signalEvents.liveCaptionsStarted({}));

                    expect(result).toEqual({
                        ...initialLiveCaptionsState,
                        isCaptioning: true,
                        status: "captioning",
                        startedAt: expect.any(Number),
                        error: undefined,
                        captionLog: [],
                    });
                });
            });

            describe("if an error occurs during initiation", () => {
                it("sets the status to 'error'", () => {
                    const result = liveCaptionsSlice.reducer(
                        undefined,
                        signalEvents.liveCaptionsStarted({ error: "some error" }),
                    );

                    expect(result).toEqual({
                        isCaptioning: false,
                        startedAt: undefined,
                        status: "error",
                        error: "some error",
                        captionLog: [],
                    });
                });
            });
        });

        describe("signalEvents.liveCaptionsStopped", () => {
            it("resets the status to undefined", () => {
                const result = liveCaptionsSlice.reducer(undefined, signalEvents.liveCaptionsStopped({}));

                expect(result).toEqual({
                    isCaptioning: false,
                    startedAt: undefined,
                    status: undefined,
                    error: undefined,
                    captionLog: [],
                });
            });
        });

        describe("signalEvents.liveCaption", () => {
            it("adds the latest caption to the captionLog", () => {
                const liveCaptionEventData: LiveCaptionEvent = {
                    senderId: "senderId",
                    resultId: "resultId",
                    text: "hello world",
                };

                const liveCaption = new LiveCaption(liveCaptionEventData);

                const result = liveCaptionsSlice.reducer(undefined, signalEvents.liveCaption(liveCaptionEventData));

                expect(result).toEqual({
                    isCaptioning: false,
                    startedAt: undefined,
                    status: undefined,
                    error: undefined,
                    captionLog: [
                        {
                            ...liveCaption,
                            timestamp: expect.any(Number),
                        } as LiveCaption,
                    ],
                });
            });

            it("updates the text of an existing part when the resultId matches", () => {
                const firstEvent: LiveCaptionEvent = {
                    senderId: "client1",
                    resultId: "result1",
                    text: "hel",
                };

                const updatedEvent: LiveCaptionEvent = {
                    senderId: "client1",
                    resultId: "result1",
                    text: "hello world",
                };

                const stateAfterFirst = liveCaptionsSlice.reducer(undefined, signalEvents.liveCaption(firstEvent));
                const result = liveCaptionsSlice.reducer(stateAfterFirst, signalEvents.liveCaption(updatedEvent));

                expect(result.captionLog).toHaveLength(1);
                expect(result.captionLog[0].parts).toEqual([{ resultId: "result1", text: "hello world" }]);
            });

            it("appends a new part when the resultId differs from the last part", () => {
                const firstEvent: LiveCaptionEvent = {
                    senderId: "client1",
                    resultId: "result1",
                    text: "first sentence",
                };

                const secondEvent: LiveCaptionEvent = {
                    senderId: "client1",
                    resultId: "result2",
                    text: "second sentence",
                };

                const stateAfterFirst = liveCaptionsSlice.reducer(undefined, signalEvents.liveCaption(firstEvent));
                const result = liveCaptionsSlice.reducer(stateAfterFirst, signalEvents.liveCaption(secondEvent));

                expect(result.captionLog).toHaveLength(1);
                expect(result.captionLog[0].parts).toEqual([
                    { resultId: "result1", text: "first sentence" },
                    { resultId: "result2", text: "second sentence" },
                ]);
            });

            it("keeps at most two parts when a third distinct resultId arrives", () => {
                const firstEvent: LiveCaptionEvent = { senderId: "client1", resultId: "result1", text: "one" };
                const secondEvent: LiveCaptionEvent = { senderId: "client1", resultId: "result2", text: "two" };
                const thirdEvent: LiveCaptionEvent = { senderId: "client1", resultId: "result3", text: "three" };

                let state = liveCaptionsSlice.reducer(undefined, signalEvents.liveCaption(firstEvent));
                state = liveCaptionsSlice.reducer(state, signalEvents.liveCaption(secondEvent));
                state = liveCaptionsSlice.reducer(state, signalEvents.liveCaption(thirdEvent));

                expect(state.captionLog).toHaveLength(1);
                expect(state.captionLog[0].parts).toEqual([
                    { resultId: "result2", text: "two" },
                    { resultId: "result3", text: "three" },
                ]);
            });

            it("moves a caption to the end of the log when a new resultId arrives for that client", () => {
                const clientAEvent: LiveCaptionEvent = { senderId: "clientA", resultId: "rA1", text: "from A" };
                const clientBEvent: LiveCaptionEvent = { senderId: "clientB", resultId: "rB1", text: "from B" };
                const clientANewResultEvent: LiveCaptionEvent = {
                    senderId: "clientA",
                    resultId: "rA2",
                    text: "A again",
                };

                let state = liveCaptionsSlice.reducer(undefined, signalEvents.liveCaption(clientAEvent));
                state = liveCaptionsSlice.reducer(state, signalEvents.liveCaption(clientBEvent));
                state = liveCaptionsSlice.reducer(state, signalEvents.liveCaption(clientANewResultEvent));

                expect(state.captionLog).toHaveLength(2);
                expect(state.captionLog[0].clientId).toBe("clientB");
                expect(state.captionLog[1].clientId).toBe("clientA");
                expect(state.captionLog[1].parts).toEqual([
                    { resultId: "rA1", text: "from A" },
                    { resultId: "rA2", text: "A again" },
                ]);
            });

            it("does not affect other clients' captions when updating one client", () => {
                const clientAEvent: LiveCaptionEvent = { senderId: "clientA", resultId: "rA1", text: "from A" };
                const clientBEvent: LiveCaptionEvent = { senderId: "clientB", resultId: "rB1", text: "from B" };
                const clientBUpdateEvent: LiveCaptionEvent = {
                    senderId: "clientB",
                    resultId: "rB1",
                    text: "from B updated",
                };

                let state = liveCaptionsSlice.reducer(undefined, signalEvents.liveCaption(clientAEvent));
                state = liveCaptionsSlice.reducer(state, signalEvents.liveCaption(clientBEvent));
                state = liveCaptionsSlice.reducer(state, signalEvents.liveCaption(clientBUpdateEvent));

                expect(state.captionLog).toHaveLength(2);
                expect(state.captionLog[0].clientId).toBe("clientA");
                expect(state.captionLog[0].parts).toEqual([{ resultId: "rA1", text: "from A" }]);
                expect(state.captionLog[1].clientId).toBe("clientB");
                expect(state.captionLog[1].parts).toEqual([{ resultId: "rB1", text: "from B updated" }]);
            });
        });
    });
});
