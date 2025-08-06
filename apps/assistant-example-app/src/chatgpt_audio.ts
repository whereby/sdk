import { AudioSink } from "@whereby.com/assistant-sdk";
export type ChatGPTVoice = "ash" | "ballad" | "coral" | "sage" | "verse";
import wrtc from "@roamhq/wrtc";
export const CHAT_GPT_VOICES: Array<ChatGPTVoice> = ["ash", "ballad", "coral", "sage", "verse"];
import * as dotenv from "dotenv";

dotenv.config();

export type ChatGPTAudioSessionInstance = {
    peerConnection: wrtc.RTCPeerConnection;
    dataChannel: wrtc.RTCDataChannel;
};

const CHATGPT_API_KEY = process.env.CHATGPT_API_KEY;

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

            try {
                this.audioSinkUnsubscribe?.();

                const audioSink = new AudioSink(audioTrack);

                this.audioSinkUnsubscribe = audioSink.subscribe((data) => {
                    this.audioSource.onData(data);
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
                Authorization: `Bearer ${CHATGPT_API_KEY}`,
                "Content-Type": "application/sdp",
            },
            body: offer.sdp,
        });

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

        this.chatGptSession = await this.createChatGPTWebRTCSession(participantMediaStream, voice);

        process.on("SIGTERM", () => {
            this.stopSession();
        });

        return this.chatGptSession;
    }

    stopSession() {
        try {
            this.audioSinkUnsubscribe?.();
        } catch {}
        this.audioSinkUnsubscribe = undefined;
        try {
            this.chatGptSession?.peerConnection.close();
        } catch {}
        this.chatGptSession = undefined;
    }
}
