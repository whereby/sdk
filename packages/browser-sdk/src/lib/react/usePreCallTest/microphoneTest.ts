export class MicrophoneTest extends EventTarget {
    async run() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.stop();
            stream.removeTrack(audioTrack);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
}
