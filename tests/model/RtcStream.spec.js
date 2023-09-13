import RtcStream, { STREAM_TYPES } from "../../src/model/RtcStream";

describe("RtcStream", () => {
    describe("constructor", () => {
        it("should throw error if id is null", () => {
            expect(() => {
                new RtcStream(null, STREAM_TYPES.SCREEN_SHARE); //eslint-disable-line no-new
            }).to.throw("id is required");
        });

        it("should throw error if id is undefined", () => {
            expect(() => {
                new RtcStream(undefined, STREAM_TYPES.SCREEN_SHARE); //eslint-disable-line no-new
            }).to.throw("id is required");
        });

        it("should throw error if type is missing", () => {
            expect(() => {
                new RtcStream("1"); //eslint-disable-line no-new
            }).to.throw("type is required");
        });

        it("should create a stream with a string id if the specified id is a number", () => {
            const stream = new RtcStream(1, STREAM_TYPES.SCREEN_SHARE);

            expect(stream.id).to.deep.equals("1");
        });

        it("should create a stream with the specified id and type", () => {
            const streamId = "1";
            const streamType = STREAM_TYPES.SCREEN_SHARE;
            const stream = new RtcStream(streamId, streamType);

            expect(stream.id).to.deep.equals(streamId);
            expect(stream.type).to.deep.equals(streamType);
        });
    });

    describe("setup", () => {
        describe("setting enabled state for streams", () => {
            let fakeStream;

            beforeEach(() => {
                fakeStream = {
                    getVideoTracks: sinon.stub().returns([{ enabled: true }]),
                    getAudioTracks: sinon.stub().returns([{ enabled: true }]),
                };
            });

            it("applies isVideoEnabled state override from earlier", () => {
                const stream = new RtcStream("id", "type");
                stream.isVideoEnabled = false;
                sinon.spy(stream, "setVideoEnabled");

                stream.setup(fakeStream);

                expect(stream.setVideoEnabled).to.have.been.calledWithExactly(false);
            });

            it("applies isAudioEnabled state override from earlier", () => {
                const stream = new RtcStream("id", "type");
                stream.isAudioEnabled = false;
                sinon.spy(stream, "setAudioEnabled");

                stream.setup(fakeStream);

                expect(stream.setAudioEnabled).to.have.been.calledWithExactly(false);
            });
        });
    });

    describe("setAudioEnabled", () => {
        let stream;
        beforeEach(() => {
            stream = new RtcStream("id", STREAM_TYPES.CAMERA);
            stream.stream = {
                getAudioTracks: sinon.stub().returns([]),
                getVideoTracks: sinon.stub().returns([]),
            };
        });

        it("defaults to being true", () => {
            expect(stream.isAudioEnabled).to.equal(true);
        });

        it("sets isAudioEnabled to the given value", () => {
            const expectedValue = false;

            stream.setAudioEnabled(expectedValue);

            expect(stream.isAudioEnabled).to.equal(expectedValue);
        });

        it("sets each stream's track' enabled property", () => {
            const track = {};
            stream.stream.getAudioTracks = sinon.stub().returns([track]);

            const expectedValue = true;
            stream.setAudioEnabled(expectedValue);

            expect(track.enabled).to.equal(expectedValue);
        });
    });

    describe("setVideoEnabled", () => {
        let stream;
        beforeEach(() => {
            stream = new RtcStream("id", STREAM_TYPES.CAMERA);
            stream.stream = {
                getAudioTracks: sinon.stub().returns([]),
                getVideoTracks: sinon.stub().returns([]),
            };
        });

        it("defaults to being true", () => {
            expect(stream.isVideoEnabled).to.equal(true);
        });

        it("sets isVideoEnabled to the given value", () => {
            const expectedValue = false;

            stream.setVideoEnabled(expectedValue);

            expect(stream.isVideoEnabled).to.equal(expectedValue);
        });

        it("sets each stream's track' enabled property", () => {
            const track = {};
            stream.stream.getVideoTracks = sinon.stub().returns([track]);

            const expectedValue = true;
            stream.setVideoEnabled(expectedValue);

            expect(track.enabled).to.equal(expectedValue);
        });
    });
});
