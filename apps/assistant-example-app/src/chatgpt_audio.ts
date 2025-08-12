import { AudioSink } from "@whereby.com/assistant-sdk";
export type ChatGPTVoice = "ash" | "ballad" | "coral" | "sage" | "verse";
import wrtc from "@roamhq/wrtc";
export const CHAT_GPT_VOICES: Array<ChatGPTVoice> = ["ash", "ballad", "coral", "sage", "verse"];

export type ChatGPTAudioSessionInstance = {
    peerConnection: wrtc.RTCPeerConnection;
    dataChannel: wrtc.RTCDataChannel;
};

export class ChatGPTAudioSession {
    private chatGptSession: ChatGPTAudioSessionInstance | undefined;
    private audioSinkUnsubscribe: (() => void) | undefined;
    private audioSource: wrtc.nonstandard.RTCAudioSource;

    constructor(audioSource: wrtc.nonstandard.RTCAudioSource) {
        this.audioSource = audioSource;
    }

    private async createChatGPTWebRTCSession(
        inputAudioStream: MediaStreamTrack,
        voice: ChatGPTVoice = "ash",
    ): Promise<ChatGPTAudioSessionInstance> {
        const pc = new wrtc.RTCPeerConnection();

        pc.addTrack(inputAudioStream);

        pc.addEventListener("track", (event: RTCTrackEvent) => {
            const [remoteStream] = event.streams;

            const audioTrack = remoteStream?.getTracks().find((t) => t.kind === "audio");

            if (!audioTrack) {
                return;
            }

            console.log("ChatGPT audio track ready!", audioTrack.id);

            try {
                this.audioSinkUnsubscribe?.();

                const audioSink = new AudioSink(audioTrack);

                this.audioSinkUnsubscribe = audioSink.subscribe(({ samples }: { samples: Uint8Array }) => {
                    const uInt16samples = new Int16Array(samples);

                    this.audioSource.onData({ samples: uInt16samples, sampleRate: 48000 });
                });
            } catch (e) {
                console.error("Failed to subscribe to audio track", { error: e });
            }
        });

        // Set up data channel for sending and receiving events
        const dc = pc.createDataChannel("oai-events");

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const model = "gpt-4o-realtime-preview-2024-12-17";

        const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${model}&voice=${voice}`, {
            method: "POST",
            headers: {
                // TO DO: un-hardcore this
                Authorization: `Bearer `,
                "Content-Type": "application/sdp",
            },
            body: offer.sdp,
        });

        console.log("SDP response received", sdpResponse);

        if (!sdpResponse.ok) {
            throw new Error(`Failed to get SDP response: ${sdpResponse.statusText}`);
        }

        await pc.setRemoteDescription({
            type: "answer",
            sdp: await sdpResponse.text(),
        });

        return {
            peerConnection: pc,
            dataChannel: dc,
        };
    }

    async startSession(
        participantMediaStream: MediaStreamTrack,
        voice?: ChatGPTVoice,
    ): Promise<ChatGPTAudioSessionInstance> {
        if (this.chatGptSession) {
            this.stopSession();
        }

        console.log("Creating connection to ChatGPT");

        this.chatGptSession = await this.createChatGPTWebRTCSession(participantMediaStream, voice);

        process.on("SIGTERM", () => {
            this.stopSession();
        });

        return this.chatGptSession;
    }

    stopSession() {
        this.audioSinkUnsubscribe?.();
        this.chatGptSession?.peerConnection.close();
    }
}
