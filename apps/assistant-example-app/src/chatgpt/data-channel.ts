import { Assistant, RemoteParticipantState } from "@whereby.com/assistant-sdk";
import { ChatGPTAudioSession } from "../chatgpt_audio.js";
import { functions } from "./functions.js";
import { ParticipantInfo, participantListPrompt, systemPrompt } from "./prompts.js";
import { responseOutputItemDoneEvent } from "./realtime-schemas.js";
import { handleRealtimeEvent } from "./event-handler.js";
let chatGptSession: ChatGPTAudioSession | null = null; // <-- keep one instance

let chatgptDataChannel: RTCDataChannel;
const chatMessageSet = new Set();

function getParticipantList(participants: RemoteParticipantState[]): ParticipantInfo[] {
    return participants.map((participant) => ({
        displayName: participant.displayName,
        id: participant.id,
    }));
}

export function setupDataChannel(assistant: Assistant, track: MediaStreamTrack) {
    const audioSource = assistant.getLocalAudioSource();

    // Get initial participant list
    const remoteParticipants = assistant.getRemoteParticipants();
    const participantList = getParticipantList(remoteParticipants);

    if (chatGptSession) {
        try {
            chatGptSession.stopSession();
        } catch {}
    }
    chatGptSession = new ChatGPTAudioSession(audioSource!);

    chatGptSession
        .startSession(track, "ash")
        .then(({ dataChannel }) => {
            chatgptDataChannel = dataChannel;
            dataChannel.addEventListener("open", () => {
                // Give list of available functions
                dataChannel.send(JSON.stringify(functions));
                // Give some system context on start
                dataChannel.send(JSON.stringify(systemPrompt));
                // Give the participant list on start
                dataChannel.send(JSON.stringify(participantListPrompt(participantList)));
            });

            dataChannel.addEventListener("message", (event) => {
                try {
                    const rawData = JSON.parse(event.data);

                    if (
                        rawData.type !== "response.output_item.done" ||
                        !responseOutputItemDoneEvent.safeParse(rawData).success
                    ) {
                        return;
                    }

                    const realtimeEvent = responseOutputItemDoneEvent.parse(rawData);
                    handleRealtimeEvent(realtimeEvent, dataChannel, assistant);
                } catch (error) {
                    console.error("Error processing realtime event:", error);
                    console.error("Raw event data:", event.data);
                }
            });
        })
        .catch((error) => {
            console.error("ChatGPT setup error:", error);
            chatGptSession?.stopSession();
            chatGptSession = null;
        });
}
