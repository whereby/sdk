export class CameraCheck extends EventTarget {
    async run() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const videoTrack = stream.getVideoTracks()[0];

        if (videoTrack) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            videoTrack.stop();
            stream.removeTrack(videoTrack);
        }
    }
}
