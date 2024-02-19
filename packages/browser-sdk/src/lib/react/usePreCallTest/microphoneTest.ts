export class MicrophoneTest extends EventTarget {
    async run() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.stop();
            stream.removeTrack(audioTrack);
        }
    }
}
