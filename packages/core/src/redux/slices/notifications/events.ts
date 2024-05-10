import { RemoteParticipant } from "../../../RoomParticipant";
import { ChatMessage } from "../chat";

export interface RequestAudioEvent {
    client: RemoteParticipant;
    enable: boolean;
}

export interface ChatMessageEvent {
    client: RemoteParticipant;
    chatMessage: ChatMessage;
}

export interface SignalStatusEvent {}

export interface StickyReactionEvent {
    client: RemoteParticipant;
    stickyReaction?: { reaction: string; timestamp: string } | null;
}

export interface Notification<T = unknown> {
    type: string;
    message: string;
    props?: T;
}

export interface NotificationEvent<T = unknown> extends Notification<T> {
    timestamp: number;
}

export interface NotificationEvents {
    "*": [NotificationEvent<unknown>];
    requestAudioEnable: [NotificationEvent<RequestAudioEvent>];
    requestAudioDisable: [NotificationEvent<RequestAudioEvent>];
    chatMessageReceived: [NotificationEvent<ChatMessageEvent>];
    remoteHandRaised: [NotificationEvent<StickyReactionEvent>];
    remoteHandLowered: [NotificationEvent<StickyReactionEvent>];
    signalTrouble: [NotificationEvent<SignalStatusEvent>];
    signalOk: [NotificationEvent<SignalStatusEvent>];
}
