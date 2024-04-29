import fakeAudioStream from "./fakeAudioStream";
import fakeWebcamFrame from "./fakeWebcamFrame";

const CANVAS_VIDEO_FPS = 24;

export function getAudioTrack() {
    const audioStream = fakeAudioStream();
    return audioStream.getAudioTracks()[0];
}

export function getVideoTrack({ canvas }: { canvas: HTMLCanvasElement }) {
    fakeWebcamFrame(canvas);
    const videoStream = canvas.captureStream(CANVAS_VIDEO_FPS);
    return videoStream.getVideoTracks()[0];
}

export default function getFakeMediaStream({ canvas, hasAudio }: { canvas: HTMLCanvasElement; hasAudio?: boolean }) {
    const tracks = [getVideoTrack({ canvas }), ...(hasAudio ? [getAudioTrack()] : [])];
    return new MediaStream(tracks);
}
