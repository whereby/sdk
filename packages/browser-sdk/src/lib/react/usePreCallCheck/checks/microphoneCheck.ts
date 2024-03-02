export class MicrophoneCheck extends EventTarget {
    async run() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        const audioTrack = stream.getAudioTracks()[0];

        if (audioTrack) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            audioTrack.stop();
            stream.removeTrack(audioTrack);
        }
    }
}
