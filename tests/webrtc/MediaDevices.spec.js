import * as MediaDevices from "../../src/webrtc/MediaDevices";
import * as helpers from "./webRtcHelpers";

const oldMediaDevices = global.navigator.mediaDevices;
afterEach(() => {
    global.navigator.mediaDevices = oldMediaDevices;
});

describe("enumerate", () => {
    let devices;

    beforeEach(() => {
        devices = [];
        global.navigator.mediaDevices = {
            enumerateDevices: () => Promise.resolve(devices),
        };
    });

    it("should remove duplicates", async () => {
        devices = [
            { deviceId: "a", kind: "videoinput" },
            { deviceId: "a", kind: "videoinput" },
            { deviceId: "b", kind: "", label: "yo" },
            { deviceId: "a", kind: "audioinput" },
            { deviceId: "b", kind: "", label: "man" },
        ];

        const result = await MediaDevices.enumerate();

        expect(result).toEqual([
            { deviceId: "a", kind: "videoinput" },
            { deviceId: "b", kind: "", label: "yo" },
            { deviceId: "a", kind: "audioinput" },
        ]);
    });
});

describe("stopStreamTracks", () => {
    let vdev;
    let adev;
    let videoTrack;
    let audioTrack;
    let stream;

    beforeEach(() => {
        vdev = { kind: "videoinput", deviceId: "vdev" };
        adev = { kind: "audioinput", deviceId: "adev" };
        videoTrack = { kind: "video", stop: jest.fn(), getCapabilities: () => vdev };
        audioTrack = { kind: "audio", stop: jest.fn(), getCapabilities: () => adev };
        stream = helpers.createMockedMediaStream([videoTrack, audioTrack]);
    });

    it("should throw when only is not audio or video", () => {
        expect(() => MediaDevices.stopStreamTracks(stream, "random-string")).toThrow();
    });

    it("should stop all tracks in the stream", () => {
        MediaDevices.stopStreamTracks(stream);

        expect(videoTrack.stop).toHaveBeenCalled();
        expect(audioTrack.stop).toHaveBeenCalled();
    });

    it("should only stop audio when only=audio", () => {
        MediaDevices.stopStreamTracks(stream, "audio");

        expect(videoTrack.stop).not.toHaveBeenCalled();
        expect(audioTrack.stop).toHaveBeenCalled();
    });
});

describe("getStream", () => {
    let vdev1;
    let vdev2;
    let adev1;
    let adev2;
    let videoTrack1;
    let videoTrack2;
    let audioTrack1;
    let audioTrack2;
    let devices;
    let stream;

    beforeEach(() => {
        vdev1 = { kind: "videoinput", deviceId: "vdev1" };
        vdev2 = { kind: "videoinput", deviceId: "vdev2" };
        adev1 = { kind: "audioinput", deviceId: "adev1" };
        adev2 = { kind: "audioinput", deviceId: "adev2" };
        videoTrack1 = { kind: "video", stop: jest.fn(), getCapabilities: () => vdev1 };
        videoTrack2 = { kind: "video", stop: jest.fn(), getCapabilities: () => vdev2 };
        audioTrack1 = { kind: "audio", stop: jest.fn(), getCapabilities: () => adev1 };
        audioTrack2 = { kind: "audio", stop: jest.fn(), getCapabilities: () => adev2 };
        devices = [vdev1, vdev2, adev1, adev2];
        stream = helpers.createMockedMediaStream([videoTrack1, audioTrack1]);
        stream.removeTrack = jest.fn();
        stream.addTrack = jest.fn();
        global.navigator.mediaDevices = {};
    });

    it("should stop all tracks in stream when switching", async () => {
        global.navigator.mediaDevices.getUserMedia = jest.fn(() => {
            return Promise.resolve(helpers.createMockedMediaStream([videoTrack1, audioTrack2]));
        });

        const promise = MediaDevices.getStream(
            {
                devices,
                videoId: vdev1.deviceId,
                audioId: adev2.deviceId,
            },
            { replaceStream: stream }
        );

        // the tracks are stopped before GUM (before the promise)
        expect(videoTrack1.stop).toHaveBeenCalled();
        expect(audioTrack1.stop).toHaveBeenCalled();
        await promise;
        expect(videoTrack1.stop).toHaveBeenCalledTimes(1);
        expect(audioTrack1.stop).toHaveBeenCalledTimes(1);
    });

    it("should NOT stop audio track in stream when switching only video", async () => {
        global.navigator.mediaDevices.getUserMedia = async () =>
            helpers.createMockedMediaStream([videoTrack1, audioTrack2]);

        await MediaDevices.getStream(
            {
                devices,
                videoId: vdev1.deviceId,
                audioId: false,
            },
            { replaceStream: stream }
        );

        expect(audioTrack1.stop).not.toHaveBeenCalled();
        expect(videoTrack1.stop).toHaveBeenCalled();
    });

    it("should reuse videoTrack if switching audio", async () => {
        global.navigator.mediaDevices.getUserMedia = jest.fn(() => {
            return Promise.resolve(helpers.createMockedMediaStream([videoTrack1, audioTrack2]));
        });

        const type = "exact";
        await MediaDevices.getStream(
            {
                devices,
                videoId: vdev1.deviceId,
                audioId: adev2.deviceId,
                type,
            },
            { replaceStream: stream }
        );

        const c = expect.objectContaining;
        expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
            c({
                video: c({ deviceId: { [type]: vdev1.deviceId } }),
                audio: c({ deviceId: { [type]: adev2.deviceId } }),
            })
        );
        expect(stream.removeTrack).toHaveBeenCalledWith(videoTrack1);
        expect(stream.removeTrack).toHaveBeenCalledWith(audioTrack1);
        expect(stream.addTrack).toHaveBeenCalledWith(videoTrack1);
        expect(stream.addTrack).toHaveBeenCalledWith(audioTrack2);
    });

    it("should reuse audioTrack if switching video", async () => {
        global.navigator.mediaDevices.getUserMedia = jest.fn(() => {
            return Promise.resolve(helpers.createMockedMediaStream([videoTrack2, audioTrack1]));
        });

        const type = "exact";
        await MediaDevices.getStream(
            {
                devices,
                videoId: vdev2.deviceId,
                audioId: adev1.deviceId,
                type,
            },
            { replaceStream: stream }
        );

        const c = expect.objectContaining;
        expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
            c({
                video: c({ deviceId: { [type]: vdev2.deviceId } }),
                audio: c({ deviceId: { [type]: adev1.deviceId } }),
            })
        );
        expect(stream.removeTrack).toHaveBeenCalledWith(videoTrack1);
        expect(stream.removeTrack).toHaveBeenCalledWith(audioTrack1);
        expect(stream.addTrack).toHaveBeenCalledWith(videoTrack2);
        expect(stream.addTrack).toHaveBeenCalledWith(audioTrack1);
    });
});

describe("getUserMedia", () => {
    it("should throw on no devices", async () => {
        let err;

        try {
            await MediaDevices.getUserMedia({});
        } catch (e) {
            err = e;
        }

        return expect(err.name).toBe("nodevices");
    });

    it("should give constraints to real getUserMedia", () => {
        global.navigator.mediaDevices = { getUserMedia: jest.fn().mockResolvedValue() };
        const constraints = { audio: Symbol("audio") };

        MediaDevices.getUserMedia(constraints);

        return expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(constraints);
    });
});

describe("getDeviceData", () => {
    it("empty stream", () => {
        const stream = helpers.createMockedMediaStream([]);

        const res = MediaDevices.getDeviceData({ stream });

        expect(res).toEqual({ audio: { deviceId: null }, video: { deviceId: null } });
    });

    it("find videoId when only video", () => {
        const vtrack = helpers.createMockedMediaStreamTrack({ id: "videotrack", kind: "video" });

        const res = MediaDevices.getDeviceData({
            audioTrack: null,
            videoTrack: vtrack,
            devices: [],
        });

        expect(res).toEqual({
            audio: { deviceId: null },
            video: { deviceId: "videotrack", label: undefined },
        });
    });

    it("find videoId when only audio", () => {
        const atrack = helpers.createMockedMediaStreamTrack({ id: "audiotrack", kind: "audio" });

        const res = MediaDevices.getDeviceData({
            audioTrack: atrack,
            devices: [],
        });

        expect(res).toEqual({
            audio: { deviceId: "audiotrack", label: undefined },
            video: { deviceId: null },
        });
    });

    it("find videoId when only audio and stoppedVideoTrack", () => {
        const atrack = helpers.createMockedMediaStreamTrack({ id: "audiotrack", kind: "audio" });
        const stopVtrack = helpers.createMockedMediaStreamTrack({ id: "stopVtrack", kind: "video" });

        const res = MediaDevices.getDeviceData({
            audioTrack: atrack,
            stoppedVideoTrack: stopVtrack,
            devices: [],
        });

        expect(res).toEqual({
            audio: { deviceId: "audiotrack", label: undefined },
            video: { deviceId: "stopVtrack", label: undefined },
        });
    });

    it("find videoId by vtrack.getSettings and audioId by atrack.label", () => {
        const stream = helpers.createMockedMediaStream();
        const vtrack = stream.getVideoTracks()[0];
        const atrack = stream.getAudioTracks()[0];

        const videoId = helpers.randomString("videoId");
        const audioId = helpers.randomString("audioId");
        vtrack.getSettings = () => ({ deviceId: videoId });
        delete atrack.getSettings;
        atrack.label = "My mic";
        vtrack.label = "My cam";
        const devices = [{ deviceId: audioId, kind: "audioinput", label: "My mic" }];

        const res = MediaDevices.getDeviceData({
            audioTrack: atrack,
            videoTrack: vtrack,
            devices,
        });

        expect(res).toEqual({
            audio: { deviceId: audioId, label: "My mic" },
            video: { deviceId: videoId, label: "My cam" },
        });
    });

    it("find deviceId through lastUsedId when track is null", () => {
        const videoId = helpers.randomString("videoId");
        const audioId = helpers.randomString("audioId");
        const devices = [
            { deviceId: videoId, kind: "videoinput", label: "My cam" },
            { deviceId: audioId, kind: "audioinput", label: "My mic" },
        ];
        const res = MediaDevices.getDeviceData({
            audioTrack: null,
            videoTrack: null,
            devices,
            lastVideoId: videoId,
        });

        expect(res).toEqual({
            audio: { deviceId: null },
            video: { deviceId: videoId },
        });
    });
});

describe("compareLocalDevices", () => {
    const internalMic = { kind: "audioinput", deviceId: "internal-mic", label: "Internal mic" };
    const externalMic = { kind: "audioinput", deviceId: "external-mic", label: "USB mic" };
    const internalCam = { kind: "videoinput", deviceId: "internal-cam", label: "Internal cam" };
    const externalCam = { kind: "videoinput", deviceId: "external-cam", label: "USB cam" };
    const headPhones = { kind: "audiooutput", deviceId: "default", label: "Headphones" };

    const empty = { added: {}, removed: {}, changed: {} };

    it.each`
        before           | after                                                   | changes
        ${[]}            | ${[]}                                                   | ${{}}
        ${[internalMic]} | ${[]}                                                   | ${{ audioinput: { ...empty, removed: { [internalMic.deviceId]: internalMic } } }}
        ${[]}            | ${[internalMic]}                                        | ${{ audioinput: { ...empty, added: { [internalMic.deviceId]: internalMic } } }}
        ${[internalMic]} | ${[internalMic]}                                        | ${{ audioinput: empty }}
        ${[internalMic]} | ${[{ ...internalMic, label: "X" }]}                     | ${{ audioinput: { ...empty, changed: { [internalMic.deviceId]: { ...internalMic, label: "X" } } } }}
        ${[internalMic]} | ${[externalMic]}                                        | ${{ audioinput: { ...empty, added: { [externalMic.deviceId]: externalMic }, removed: { [internalMic.deviceId]: internalMic } } }}
        ${[internalMic]} | ${[internalMic, externalMic]}                           | ${{ audioinput: { ...empty, added: { [externalMic.deviceId]: externalMic } } }}
        ${[]}            | ${[internalMic, externalMic, internalCam, externalCam]} | ${{ audioinput: { ...empty, added: { [internalMic.deviceId]: internalMic, [externalMic.deviceId]: externalMic } }, videoinput: { ...empty, added: { [internalCam.deviceId]: internalCam, [externalCam.deviceId]: externalCam } } }}
        ${[]}            | ${[headPhones]}                                         | ${{ audiooutput: { ...empty, added: { [headPhones.deviceId]: headPhones } } }}
    `(
        `expect changes:$changes when
            before:$before,
            after:$after
    `,
        ({ before, after, changes }) => {
            const changesByKind = MediaDevices.compareLocalDevices(before, after);

            expect(changesByKind).toStrictEqual(changes);
        }
    );
});

describe("getUpdatedDevices", () => {
    const aId = helpers.randomString("audioid");
    const sId = helpers.randomString("speakerId");
    const vId = helpers.randomString("videoId");
    const aDevice = { kind: "audioinput", deviceId: aId, label: helpers.randomString("Internal mic") };
    const sDevice = { kind: "audiooutput", deviceId: sId, label: helpers.randomString("Internal speaker") };
    const vDevice = { kind: "videoinput", deviceId: vId, label: helpers.randomString("Internal cam") };
    const aId2 = helpers.randomString("audioid2");
    const sId2 = helpers.randomString("speakerId2");
    const vId2 = helpers.randomString("videoId2");
    const aDevice2 = { kind: "audioinput", deviceId: aId2, label: helpers.randomString("External mic") };
    const sDevice2 = { kind: "audiooutput", deviceId: sId2, label: helpers.randomString("Internal speaker") };
    const vDevice2 = { kind: "videoinput", deviceId: vId2, label: helpers.randomString("External cam") };

    it.each`
        oldDevices             | newDevices                        | currentAId   | currentVId   | currentSId   | expectedChanges
        ${[]}                  | ${[]}                             | ${undefined} | ${undefined} | ${undefined} | ${{ addedDevices: {}, changedDevices: {} }}
        ${[]}                  | ${[aDevice, vDevice]}             | ${undefined} | ${undefined} | ${undefined} | ${{ addedDevices: { audioinput: aDevice, videoinput: vDevice }, changedDevices: {} }}
        ${[aDevice]}           | ${[aDevice, aDevice2]}            | ${aId}       | ${undefined} | ${undefined} | ${{ addedDevices: { audioinput: aDevice2 }, changedDevices: {} }}
        ${[aDevice]}           | ${[]}                             | ${aId}       | ${undefined} | ${undefined} | ${{ addedDevices: {}, changedDevices: { audioinput: { deviceId: null } } }}
        ${[aDevice]}           | ${[{ ...aDevice, label: "new" }]} | ${aId}       | ${undefined} | ${undefined} | ${{ addedDevices: {}, changedDevices: { audioinput: { deviceId: aDevice.deviceId } } }}
        ${[aDevice, vDevice]}  | ${[aDevice2, vDevice2]}           | ${aId}       | ${vId}       | ${undefined} | ${{ addedDevices: { audioinput: aDevice2, videoinput: vDevice2 }, changedDevices: { audioinput: { deviceId: null }, videoinput: { deviceId: null } } }}
        ${[aDevice, vDevice]}  | ${[aDevice, vDevice, vDevice2]}   | ${aId}       | ${vId}       | ${undefined} | ${{ addedDevices: { videoinput: vDevice2 }, changedDevices: {} }}
        ${[]}                  | ${[sDevice]}                      | ${undefined} | ${undefined} | ${undefined} | ${{ addedDevices: { audiooutput: sDevice }, changedDevices: {} }}
        ${[sDevice, sDevice2]} | ${[sDevice2]}                     | ${undefined} | ${undefined} | ${sId}       | ${{ addedDevices: {}, changedDevices: { audiooutput: { deviceId: sDevice2.deviceId } } }}
    `(
        `expect $expectedChanges when
            oldDevices:$oldDevices,
            newDevices:$newDevices,
            currentAudioId:$currentAId,
            currentVideoId:$currentVId
    `,
        ({ expectedChanges, oldDevices, newDevices, currentAId, currentVId, currentSId }) => {
            const updatedUserMediaConstraints = MediaDevices.getUpdatedDevices({
                oldDevices,
                newDevices,
                currentAudioId: currentAId,
                currentVideoId: currentVId,
                currentSpeakerId: currentSId,
            });

            expect(updatedUserMediaConstraints).toStrictEqual(expectedChanges);
        }
    );
});
