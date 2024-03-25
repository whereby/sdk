import { RtcStream, STREAM_TYPES } from "../../src/model/RtcStream";

describe("RtcStream", () => {
    describe("constructor", () => {
        it("should create a stream with a string id if the specified id is a number", () => {
            const stream = new RtcStream(1, STREAM_TYPES.SCREEN_SHARE);

            expect(stream.id).toEqual("1");
        });

        it("should create a stream with the specified id and type", () => {
            const streamId = "1";
            const streamType = STREAM_TYPES.SCREEN_SHARE;
            const stream = new RtcStream(streamId, streamType);

            expect(stream.id).toEqual(streamId);
            expect(stream.type).toEqual(streamType);
        });
    });

    describe("setup", () => {
        describe("setting enabled state for streams", () => {
            let fakeStream: any;

            beforeEach(() => {
                fakeStream = {
                    getVideoTracks: jest.fn(() => [{ enabled: true }]),
                    getAudioTracks: jest.fn(() => [{ enabled: true }]),
                };
            });

            it("applies isVideoEnabled state override from earlier", () => {
                const stream = new RtcStream("id", "type");
                stream.isVideoEnabled = false;
                jest.spyOn(stream, "setVideoEnabled");

                stream.setup(fakeStream);

                expect(stream.setVideoEnabled).toHaveBeenCalledWith(false);
            });

            it("applies isAudioEnabled state override from earlier", () => {
                const stream = new RtcStream("id", "type");
                stream.isAudioEnabled = false;
                jest.spyOn(stream, "setAudioEnabled");

                stream.setup(fakeStream);

                expect(stream.setAudioEnabled).toHaveBeenCalledWith(false);
            });
        });
    });

    describe("setAudioEnabled", () => {
        let stream: any;
        beforeEach(() => {
            stream = new RtcStream("id", STREAM_TYPES.CAMERA);
            stream.stream = {
                getAudioTracks: jest.fn(() => []),
                getVideoTracks: jest.fn(() => []),
            };
        });

        it("defaults to being true", () => {
            expect(stream.isAudioEnabled).toEqual(true);
        });

        it("sets isAudioEnabled to the given value", () => {
            const expectedValue = false;

            stream.setAudioEnabled(expectedValue);

            expect(stream.isAudioEnabled).toEqual(expectedValue);
        });

        it("sets each stream's track' enabled property", () => {
            const track: any = {};
            stream.stream.getAudioTracks = jest.fn(() => [track]);

            const expectedValue = true;
            stream.setAudioEnabled(expectedValue);

            expect(track.enabled).toEqual(expectedValue);
        });
    });

    describe("setVideoEnabled", () => {
        let stream: any;
        beforeEach(() => {
            stream = new RtcStream("id", STREAM_TYPES.CAMERA);
            stream.stream = {
                getAudioTracks: jest.fn(() => []),
                getVideoTracks: jest.fn(() => []),
            };
        });

        it("defaults to being true", () => {
            expect(stream.isVideoEnabled).toEqual(true);
        });

        it("sets isVideoEnabled to the given value", () => {
            const expectedValue = false;

            stream.setVideoEnabled(expectedValue);

            expect(stream.isVideoEnabled).toEqual(expectedValue);
        });

        it("sets each stream's track' enabled property", () => {
            const track: any = {};
            stream.stream.getVideoTracks = jest.fn(() => [track]);

            const expectedValue = true;
            stream.setVideoEnabled(expectedValue);

            expect(track.enabled).toEqual(expectedValue);
        });
    });
});
