import { LiveCaptionEvent } from "@whereby.com/media";
import { liveCaptionsSlice, initialLiveCaptionsState } from "../liveCaptions";
import { signalEvents } from "../signalConnection/actions";

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
            it("adds the first caption to an empty log", () => {
                const event: LiveCaptionEvent = {
                    senderId: "client1",
                    resultId: "result1",
                    text: "hello world",
                };

                const result = liveCaptionsSlice.reducer(undefined, signalEvents.liveCaption(event));

                expect(result.captionLog).toHaveLength(1);
                expect(result.captionLog[0]).toMatchObject({
                    resultId: "result1",
                    participantId: "client1",
                    text: "hello world",
                    timestamp: expect.any(Number),
                });
            });

            it("appends a new entry when the resultId differs from the last caption", () => {
                const firstEvent: LiveCaptionEvent = { senderId: "client1", resultId: "result1", text: "first" };
                const secondEvent: LiveCaptionEvent = { senderId: "client1", resultId: "result2", text: "second" };

                let state = liveCaptionsSlice.reducer(undefined, signalEvents.liveCaption(firstEvent));
                state = liveCaptionsSlice.reducer(state, signalEvents.liveCaption(secondEvent));

                expect(state.captionLog).toHaveLength(2);
                expect(state.captionLog[0]).toMatchObject({ resultId: "result1", text: "first" });
                expect(state.captionLog[1]).toMatchObject({ resultId: "result2", text: "second" });
            });

            it("replaces the last entry's text when the resultId matches", () => {
                const firstEvent: LiveCaptionEvent = { senderId: "client1", resultId: "result1", text: "hel" };
                const updateEvent: LiveCaptionEvent = { senderId: "client1", resultId: "result1", text: "hello world" };

                let state = liveCaptionsSlice.reducer(undefined, signalEvents.liveCaption(firstEvent));
                state = liveCaptionsSlice.reducer(state, signalEvents.liveCaption(updateEvent));

                expect(state.captionLog).toHaveLength(1);
                expect(state.captionLog[0]).toMatchObject({ resultId: "result1", text: "hello world" });
            });

            it("only compares against the last entry — same resultId as a non-last entry still appends", () => {
                const firstEvent: LiveCaptionEvent = { senderId: "clientA", resultId: "result1", text: "from A" };
                const secondEvent: LiveCaptionEvent = { senderId: "clientB", resultId: "result2", text: "from B" };
                // result1 matches the first entry but not the last, so a new entry should be appended
                const thirdEvent: LiveCaptionEvent = { senderId: "clientA", resultId: "result1", text: "from A again" };

                let state = liveCaptionsSlice.reducer(undefined, signalEvents.liveCaption(firstEvent));
                state = liveCaptionsSlice.reducer(state, signalEvents.liveCaption(secondEvent));
                state = liveCaptionsSlice.reducer(state, signalEvents.liveCaption(thirdEvent));

                expect(state.captionLog).toHaveLength(3);
                expect(state.captionLog[2]).toMatchObject({
                    resultId: "result1",
                    participantId: "clientA",
                    text: "from A again",
                });
            });
        });
    });
});
