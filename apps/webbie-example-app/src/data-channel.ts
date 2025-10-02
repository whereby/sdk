import { Assistant, RemoteParticipantState } from "@whereby.com/assistant-sdk";
import { ChatGPTAudioSession } from "./chatgpt-audio.js";
import { functions } from "./functions.js";
import { ParticipantInfo, participantListPrompt, sessionUpdate, systemPrompt } from "./prompts.js";
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

    const WAKE = ["webbie", "webby", "wubby"]; // add variants as needed
    chatGptSession
        .startSession(track, "ash")
        .then(({ dataChannel }) => {
            chatgptDataChannel = dataChannel;
            dataChannel.addEventListener("open", () => {
                console.log("Data channel opened");
                // dataChannel.send(JSON.stringify({ type: "response.cancel" }));
                // Give some system context on start
                dataChannel.send(JSON.stringify(sessionUpdate));
                dataChannel.send(JSON.stringify(systemPrompt));
                // Give list of available functions
                dataChannel.send(JSON.stringify(functions));
                // Give the participant list on start
                dataChannel.send(JSON.stringify(participantListPrompt(participantList)));
            });

            dataChannel.addEventListener("message", (evt) => {
                // try {
                //
                //     const rawData = JSON.parse(event.data);
                //
                //     if (
                //         rawData.type !== "response.output_item.done" ||
                //         !responseOutputItemDoneEvent.safeParse(rawData).success
                //     ) {
                //         return;
                //     }
                //
                //     const realtimeEvent = responseOutputItemDoneEvent.parse(rawData);
                //     handleRealtimeEvent(realtimeEvent, dataChannel, assistant);
                // } catch (error) {
                //     console.error("Error processing realtime event:", error);
                //     console.error("Raw event data:", event.data);
                // }
                //
                // console.log("Data channel message:", evt.data);
                const msg = JSON.parse(evt.data);
                console.log("ChatGPT event:", msg);

                // The exact event name can vary by SDK; look for transcript-bearing events.
                // In docs you'll see events like "input_audio_transcription.completed" with a `transcript`.
                if (msg.transcript) {
                    const t = msg.transcript.toLowerCase();
                    console.log("Transcription:", t);
                    if (WAKE.some((w) => t.includes(w))) {
                        console.log("Wake word detected!");
                        const userText = t.replace(WAKE, "").trim();
                        // Only now ask the model to speak:
                        dataChannel.send(
                            JSON.stringify({
                                type: "response.create",
                                response: {
                                    modalities: ["audio", "text"],
                                    instructions: userText || "Yes?",
                                },
                            }),
                        );
                    } else {
                        dataChannel.send(JSON.stringify({ type: "response.cancel" }));
                        // Optional hygiene if you’re batching/committing buffers manually:
                        dataChannel.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
                    }
                }
            });
        })
        .catch((error) => {
            console.error("ChatGPT setup error:", error);
            chatGptSession?.stopSession();
            chatGptSession = null;
        });
}
