import { Assistant } from "@whereby.com/assistant-sdk";
import {
    parseFunctionArguments,
    participantIdArguments,
    responseCreateEvent,
    ResponseOutputItemDoneEvent,
    chatMessageArguments,
} from "./realtime-schemas.js";

export function handleRealtimeEvent(
    realtimeEvent: ResponseOutputItemDoneEvent,
    dataChannel: RTCDataChannel,
    assistant: Assistant,
) {
    switch (realtimeEvent.type) {
        case "response.output_item.done":
            if (realtimeEvent.item.type !== "function_call") return;

            if (realtimeEvent.item.name === "start_cloud_recording") {
                const response = responseCreateEvent.parse({ type: "response.create" });
                dataChannel.send(JSON.stringify(response));
                assistant.startCloudRecording();
            }
            if (realtimeEvent.item.name === "stop_cloud_recording") {
                const response = responseCreateEvent.parse({ type: "response.create" });
                dataChannel.send(JSON.stringify(response));
                assistant.stopCloudRecording();
            }
            if (realtimeEvent.item.name === "send_chat_message") {
                const args = parseFunctionArguments(chatMessageArguments, realtimeEvent.item.arguments);
                const chatText = args.text;

                assistant.sendChatMessage(chatText || "No message provided");
                const response = responseCreateEvent.parse({ type: "response.create" });
                dataChannel.send(JSON.stringify(response));
            }
            if (realtimeEvent.item.name === "spotlight_participant") {
                const args = parseFunctionArguments(participantIdArguments, realtimeEvent.item.arguments);
                assistant.spotlightParticipant(args.participant_id);
                const response = responseCreateEvent.parse({ type: "response.create" });
                dataChannel.send(JSON.stringify(response));
            }
            if (realtimeEvent.item.name === "remove_spotlight") {
                const args = parseFunctionArguments(participantIdArguments, realtimeEvent.item.arguments);
                assistant.removeSpotlight(args.participant_id);
                const response = responseCreateEvent.parse({ type: "response.create" });
                dataChannel.send(JSON.stringify(response));
            }
            if (realtimeEvent.item.name === "request_audio_enable") {
                const args = parseFunctionArguments(participantIdArguments, realtimeEvent.item.arguments);
                assistant.requestAudioEnable(args.participant_id, true);
                const response = responseCreateEvent.parse({ type: "response.create" });
                dataChannel.send(JSON.stringify(response));
            }
            if (realtimeEvent.item.name === "request_audio_disable") {
                const args = parseFunctionArguments(participantIdArguments, realtimeEvent.item.arguments);
                assistant.requestAudioEnable(args.participant_id, false);
                const response = responseCreateEvent.parse({ type: "response.create" });
                dataChannel.send(JSON.stringify(response));
            }
            if (realtimeEvent.item.name === "request_video_enable") {
                const args = parseFunctionArguments(participantIdArguments, realtimeEvent.item.arguments);
                assistant.requestVideoEnable(args.participant_id, true);
                const response = responseCreateEvent.parse({ type: "response.create" });
                dataChannel.send(JSON.stringify(response));
            }
            if (realtimeEvent.item.name === "request_video_disable") {
                const args = parseFunctionArguments(participantIdArguments, realtimeEvent.item.arguments);
                assistant.requestVideoEnable(args.participant_id, false);
                const response = responseCreateEvent.parse({ type: "response.create" });
                dataChannel.send(JSON.stringify(response));
            }
            if (realtimeEvent.item.name === "accept_waiting_participant") {
                const args = parseFunctionArguments(participantIdArguments, realtimeEvent.item.arguments);
                assistant.acceptWaitingParticipant(args.participant_id);
                const response = responseCreateEvent.parse({ type: "response.create" });
                dataChannel.send(JSON.stringify(response));
            }
            if (realtimeEvent.item.name === "reject_waiting_participant") {
                const args = parseFunctionArguments(participantIdArguments, realtimeEvent.item.arguments);
                assistant.rejectWaitingParticipant(args.participant_id);
                const response = responseCreateEvent.parse({ type: "response.create" });
                dataChannel.send(JSON.stringify(response));
            }
            break;
    }
}
