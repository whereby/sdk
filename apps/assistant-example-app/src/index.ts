import "@whereby.com/assistant-sdk/polyfills";
import { ChatGPTAudioSession } from "./chatgpt_audio.js";
import { Trigger, ASSISTANT_JOIN_SUCCESS, AUDIO_STREAM_READY } from "@whereby.com/assistant-sdk";
import { functions } from "./chatgpt/functions.js";
import { participantListPrompt, systemPrompt } from "./chatgpt/prompts.js";
import type { ParticipantInfo } from "./chatgpt/prompts.js";
import type { RemoteParticipantState } from "@whereby.com/assistant-sdk";
import { responseOutputItemDoneEvent } from "./chatgpt/realtime-schemas.js";
import { handleRealtimeEvent } from "./chatgpt/event-handler.js";
import { fetchJoke } from "./fetch-joke.js";

let hasJoinedRoom = false;

let chatGptSession: ChatGPTAudioSession | null = null; // <-- keep one instance

function getParticipantList(participants: RemoteParticipantState[]): ParticipantInfo[] {
    return participants.map((participant) => ({
        displayName: participant.displayName,
        id: participant.id,
    }));
}

function main() {
    let chatgptDataChannel: RTCDataChannel;
    const chatMessageSet = new Set();
    const trigger = new Trigger({
        webhookTriggers: {
            "room.client.joined": () => !hasJoinedRoom,
        },
        port: 3000,
        assistantKey: "",
        startCombinedAudioStream: true,
        startLocalMedia: true,
    });

    console.log("Starting webhook listener on port 3000");

    trigger.start();

    trigger.on(ASSISTANT_JOIN_SUCCESS, ({ assistant }) => {
        console.log("Assistant joined the room");
        hasJoinedRoom = true;
        assistant.on(AUDIO_STREAM_READY, ({ track }) => {
            assistant.sendChatMessage("Hello! I am your AI assistant. How can I help you today?");
            //     const audioSource = assistant.getLocalAudioSource();
            //
            //     // Get initial participant list
            //     const remoteParticipants = assistant.getRemoteParticipants();
            //     const participantList = getParticipantList(remoteParticipants);
            //
            //     if (chatGptSession) {
            //         try {
            //             chatGptSession.stopSession();
            //         } catch {}
            //     }
            //     chatGptSession = new ChatGPTAudioSession(audioSource!);
            //
            //     chatGptSession
            //         .startSession(track, "ash")
            //         .then(({ dataChannel }) => {
            //             chatgptDataChannel = dataChannel;
            //             dataChannel.addEventListener("open", () => {
            //                 // Give list of available functions
            //                 dataChannel.send(JSON.stringify(functions));
            //                 // Give some system context on start
            //                 dataChannel.send(JSON.stringify(systemPrompt));
            //                 // Give the participant list on start
            //                 dataChannel.send(JSON.stringify(participantListPrompt(participantList)));
            //             });
            //
            //             dataChannel.addEventListener("message", (event) => {
            //                 try {
            //                     const rawData = JSON.parse(event.data);
            //
            //                     if (
            //                         rawData.type !== "response.output_item.done" ||
            //                         !responseOutputItemDoneEvent.safeParse(rawData).success
            //                     ) {
            //                         return;
            //                     }
            //
            //                     const realtimeEvent = responseOutputItemDoneEvent.parse(rawData);
            //                     handleRealtimeEvent(realtimeEvent, dataChannel, assistant);
            //                 } catch (error) {
            //                     console.error("Error processing realtime event:", error);
            //                     console.error("Raw event data:", event.data);
            //                 }
            //             });
            //         })
            //         .catch((error) => {
            //             console.error("ChatGPT setup error:", error);
            //             chatGptSession?.stopSession();
            //             chatGptSession = null;
            //         });
        });

        assistant.subscribeToRemoteParticipants((remoteParticipants) => {
            // if (!chatgptDataChannel || chatgptDataChannel.readyState !== "open") {
            //     return;
            // }
            //
            // const participantList = getParticipantList(remoteParticipants);
            // chatgptDataChannel.send(JSON.stringify(participantListPrompt(participantList)));
        });

        assistant.subscribeToChatMessages((chatMessages) => {
            chatMessages.forEach((chatMessage, index) => {
                if (chatMessageSet.has(index)) {
                    return;
                }
                chatMessageSet.add(index);

                if (chatMessage.text.toLowerCase().includes("tell me a joke")) {
                    assistant.sendChatMessage("Sure! Let me find one for you...");
                    fetchJoke()
                        .then((joke) => {
                            assistant.sendChatMessage(joke);
                        })
                        .catch(() => {
                            assistant.sendChatMessage("Sorry, I couldn't fetch a joke at the moment.");
                        });
                }
            });
        });
    });
}

main();
