export class CameraTest extends EventTarget {
    async run() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.stop();
            stream.removeTrack(videoTrack);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
}
