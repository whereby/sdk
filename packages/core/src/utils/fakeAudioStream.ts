export default function fakeAudioStream() {
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const destination = audioCtx.createMediaStreamDestination();
    oscillator.connect(destination);
    oscillator.start();
    return destination.stream;
}
