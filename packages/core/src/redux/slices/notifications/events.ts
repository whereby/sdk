import { RemoteParticipant } from "../../../RoomParticipant";
import { ChatMessage } from "../chat";

export interface NotificationEvent<Type = string, PropsType = unknown> {
    type: Type;
    message: string;
    props: PropsType;
    timestamp: number;
}

export type Notification<Type, PropsType> = Omit<NotificationEvent<Type, PropsType>, "timestamp">;

export interface RequestAudioEventProps {
    client: RemoteParticipant;
    enable: boolean;
}
export type RequestAudioEvent = NotificationEvent<"requestAudioEnable" | "requestAudioDisable", RequestAudioEventProps>;

export interface ChatMessageEventProps {
    client: RemoteParticipant;
    chatMessage: ChatMessage;
}
export type ChatMessageEvent = NotificationEvent<"chatMessageReceived", ChatMessageEventProps>;

export interface SignalStatusEventProps {}
export type SignalStatusEvent = NotificationEvent<"signalTrouble" | "signalOk", SignalStatusEventProps>;

export interface SignalClientEventProps {}
export type SignalClientEvent = NotificationEvent<"clientUnableToJoinFullRoom", SignalClientEventProps>;

export interface StickyReactionEventProps {
    client: RemoteParticipant;
    stickyReaction?: { reaction: string; timestamp: string } | null;
}
export type StickyReactionEvent = NotificationEvent<"remoteHandRaised" | "remoteHandLowered", StickyReactionEventProps>;

type NotificationEventTypes = {
    ["requestAudioEnable"]: RequestAudioEvent;
    ["requestAudioDisable"]: RequestAudioEvent;
    ["chatMessageReceived"]: ChatMessageEvent;
    ["remoteHandRaised"]: StickyReactionEvent;
    ["remoteHandLowered"]: StickyReactionEvent;
    ["signalTrouble"]: SignalStatusEvent;
    ["signalOk"]: SignalStatusEvent;
    ["clientUnableToJoinFullRoom"]: SignalClientEvent;
};

export type NotificationEvents = NotificationEventTypes[keyof NotificationEventTypes];

export type NotificationEventMap = { "*": [NotificationEvents] } & {
    [Type in keyof NotificationEventTypes]: [NotificationEventTypes[Type]];
};
