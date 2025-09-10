import {
    ClientView,
    ConnectionStatus,
    doAcceptWaitingParticipant,
    doAppStart,
    doAppStop,
    doBreakoutJoin,
    doEndMeeting,
    doKickParticipant,
    doKnockRoom,
    doLockRoom,
    doRejectWaitingParticipant,
    doRemoveSpotlight,
    doRequestAudioEnable,
    doRequestVideoEnable,
    doRtcReportStreamResolution,
    doSendChatMessage,
    doSetLocalStickyReaction,
    doSpotlightParticipant,
    doStartCloudRecording,
    doStartScreenshare,
    doStopCloudRecording,
    doStopScreenshare,
    selectNotificationsEmitter,
    setDisplayName,
    signalEvents,
    startAppListening,
    toggleCameraEnabled,
    toggleLowDataModeEnabled,
    toggleMicrophoneEnabled,
} from "../../redux";
import type { Store as AppStore } from "../../redux/store";
import type {
    BreakoutState,
    ChatMessage,
    LocalParticipantState,
    LocalScreenshareStatus,
    RemoteParticipantState,
    RoomConnectionState,
    ScreenshareState,
    WaitingParticipantState,
    WherebyClientOptions,
} from "./types";
import {
    BREAKOUT_CONFIG_CHANGED,
    CHAT_NEW_MESSAGE,
    CLOUD_RECORDING_STATUS_CHANGED,
    CONNECTION_STATUS_CHANGED,
    LOCAL_PARTICIPANT_CHANGED,
    LOCAL_SCREENSHARE_STATUS_CHANGED,
    REMOTE_PARTICIPANTS_CHANGED,
    ROOM_JOINED,
    ROOM_JOINED_ERROR,
    SCREENSHARE_STARTED,
    SCREENSHARE_STOPPED,
    SPOTLIGHT_PARTICIPANT_ADDED,
    SPOTLIGHT_PARTICIPANT_REMOVED,
    STREAMING_STARTED,
    STREAMING_STOPPED,
    WAITING_PARTICIPANT_JOINED,
    WAITING_PARTICIPANT_LEFT,
    type RoomConnectionEvents,
} from "./events";
import { selectRoomConnectionState } from "./selector";
import { coreVersion } from "../../version";
import { BaseClient } from "../BaseClient";

export class RoomConnectionClient extends BaseClient<RoomConnectionState, RoomConnectionEvents> {
    private options: WherebyClientOptions;
    private selfId: string | null = null;

    private chatMessageSubscribers = new Set<(messages: ChatMessage[]) => void>();
    private cloudRecordingSubscribers = new Set<(status: { status: "recording" } | undefined) => void>();
    private breakoutSubscribers = new Set<(config: BreakoutState) => void>();
    private connectionStatusSubscribers = new Set<(status: ConnectionStatus) => void>();
    private liveStreamSubscribers = new Set<(status: { status: "streaming" } | undefined) => void>();
    private localScreenshareStatusSubscribers = new Set<(status?: LocalScreenshareStatus) => void>();
    private localParticipantSubscribers = new Set<(participant?: LocalParticipantState) => void>();
    private remoteParticipantsSubscribers = new Set<(participants: RemoteParticipantState[]) => void>();
    private screenshareSubscribers = new Set<(screenshares: ScreenshareState[]) => void>();
    private waitingParticipantsSubscribers = new Set<(participants: WaitingParticipantState[]) => void>();
    private spotlightedParticipantsSubscribers = new Set<(participants: ClientView[]) => void>();

    constructor(store: AppStore) {
        super(store);
        this.options = {};
        this.registerAppListeners();
    }

    protected handleStateChanges(state: RoomConnectionState, previousState: RoomConnectionState): void {
        if (state.chatMessages !== previousState.chatMessages) {
            this.chatMessageSubscribers.forEach((cb) => cb(state.chatMessages));
        }

        if (state.cloudRecording !== previousState.cloudRecording) {
            this.cloudRecordingSubscribers.forEach((cb) =>
                cb(state.cloudRecording ? { status: "recording" } : undefined),
            );
            this.emit(CLOUD_RECORDING_STATUS_CHANGED, state.cloudRecording ? { status: "recording" } : undefined);
        }

        if (state.breakout !== previousState.breakout) {
            this.breakoutSubscribers.forEach((cb) => cb(state.breakout));
            this.emit(BREAKOUT_CONFIG_CHANGED, state.breakout);
        }

        if (state.connectionStatus !== previousState.connectionStatus) {
            this.connectionStatusSubscribers.forEach((cb) => cb(state.connectionStatus));
            this.emit(CONNECTION_STATUS_CHANGED, state.connectionStatus);
        }

        if (state.liveStream !== previousState.liveStream) {
            this.liveStreamSubscribers.forEach((cb) => cb(state.liveStream));
            if (state.liveStream?.status === "streaming") {
                this.emit(STREAMING_STARTED, state.liveStream);
            } else {
                this.emit(STREAMING_STOPPED);
            }
        }

        if (state.localScreenshareStatus !== previousState.localScreenshareStatus) {
            this.localScreenshareStatusSubscribers.forEach((cb) => cb(state.localScreenshareStatus));
            this.emit(LOCAL_SCREENSHARE_STATUS_CHANGED, state.localScreenshareStatus);
        }

        if (state.localParticipant !== previousState.localParticipant) {
            this.localParticipantSubscribers.forEach((cb) => cb(state.localParticipant));
            this.emit(LOCAL_PARTICIPANT_CHANGED, state.localParticipant);
        }

        if (state.remoteParticipants !== previousState.remoteParticipants) {
            this.remoteParticipantsSubscribers.forEach((cb) => cb(state.remoteParticipants));
            this.emit(REMOTE_PARTICIPANTS_CHANGED, state.remoteParticipants);
        }

        if (state.screenshares !== previousState.screenshares) {
            this.screenshareSubscribers.forEach((cb) => cb(state.screenshares));

            const added = state.screenshares.filter((c) => !previousState.screenshares.some((p) => p.id === c.id));
            const removed = previousState.screenshares.filter((p) => !state.screenshares.some((c) => c.id === p.id));

            added.forEach((screenshare) => {
                this.emit(SCREENSHARE_STARTED, screenshare);
            });
            removed.forEach((screenshare) => {
                this.emit(SCREENSHARE_STOPPED, screenshare.id);
            });
        }

        if (state.waitingParticipants !== previousState.waitingParticipants) {
            this.waitingParticipantsSubscribers.forEach((cb) => cb(state.waitingParticipants));

            const added = state.waitingParticipants.filter(
                (c) => !previousState.waitingParticipants.some((p) => p.id === c.id),
            );
            const removed = previousState.waitingParticipants.filter(
                (p) => !state.waitingParticipants.some((c) => c.id === p.id),
            );

            added.forEach((participant) => {
                this.emit(WAITING_PARTICIPANT_JOINED, participant);
            });
            removed.forEach((participant) => {
                this.emit(WAITING_PARTICIPANT_LEFT, participant.id);
            });
        }

        if (state.spotlightedParticipants !== previousState.spotlightedParticipants) {
            this.spotlightedParticipantsSubscribers.forEach((cb) => cb(state.spotlightedParticipants));

            const added = state.spotlightedParticipants.filter(
                (c) => !previousState.spotlightedParticipants.some((p) => p.id === c.id),
            );
            const removed = previousState.spotlightedParticipants.filter(
                (p) => !state.spotlightedParticipants.some((c) => c.id === p.id),
            );

            added.forEach((participant) => {
                this.emit(SPOTLIGHT_PARTICIPANT_ADDED, participant);
            });
            removed.forEach((participant) => {
                this.emit(SPOTLIGHT_PARTICIPANT_REMOVED, participant.id);
            });
        }
    }

    private registerAppListeners() {
        startAppListening({
            actionCreator: signalEvents.roomJoined,
            effect: ({ payload }) => {
                if ("error" in payload) {
                    this.emit(ROOM_JOINED_ERROR, payload.error);
                    return;
                }

                const { selfId } = payload;
                this.selfId = selfId;
                this.emit(ROOM_JOINED, {
                    isLocked: payload.room.isLocked,
                    selfId,
                });
            },
        });

        startAppListening({
            actionCreator: signalEvents.chatMessage,
            effect: ({ payload }) => {
                this.emit(CHAT_NEW_MESSAGE, payload);
            },
        });
    }

    /* Subscriptions */
    public subscribeToChatMessages(callback: (messages: ChatMessage[]) => void): () => void {
        this.chatMessageSubscribers.add(callback);
        return () => this.chatMessageSubscribers.delete(callback);
    }

    public subscribeToCloudRecording(callback: (status: { status: "recording" } | undefined) => void): () => void {
        this.cloudRecordingSubscribers.add(callback);
        return () => this.cloudRecordingSubscribers.delete(callback);
    }

    public subscribeToBreakoutConfig(callback: (config: BreakoutState) => void): () => void {
        this.breakoutSubscribers.add(callback);
        return () => this.breakoutSubscribers.delete(callback);
    }

    public subscribeToConnectionStatus(callback: (status: ConnectionStatus) => void): () => void {
        this.connectionStatusSubscribers.add(callback);
        return () => this.connectionStatusSubscribers.delete(callback);
    }

    public subscribeToLiveStream(callback: (status: { status: "streaming" } | undefined) => void): () => void {
        this.liveStreamSubscribers.add(callback);
        return () => this.liveStreamSubscribers.delete(callback);
    }

    public subscribeToLocalScreenshareStatus(callback: (status?: LocalScreenshareStatus) => void): () => void {
        this.localScreenshareStatusSubscribers.add(callback);
        return () => this.localScreenshareStatusSubscribers.delete(callback);
    }

    public subscribeToLocalParticipant(callback: (participant?: LocalParticipantState) => void): () => void {
        this.localParticipantSubscribers.add(callback);
        return () => this.localParticipantSubscribers.delete(callback);
    }

    public subscribeToRemoteParticipants(callback: (participants: RemoteParticipantState[]) => void): () => void {
        this.remoteParticipantsSubscribers.add(callback);
        return () => this.remoteParticipantsSubscribers.delete(callback);
    }

    public subscribeToScreenshares(callback: (screenshares: ScreenshareState[]) => void): () => void {
        this.screenshareSubscribers.add(callback);
        return () => this.screenshareSubscribers.delete(callback);
    }

    public subscribeToWaitingParticipants(callback: (participants: WaitingParticipantState[]) => void): () => void {
        this.waitingParticipantsSubscribers.add(callback);
        return () => this.waitingParticipantsSubscribers.delete(callback);
    }

    public subscribeToSpotlightedParticipants(callback: (participants: ClientView[]) => void): () => void {
        this.spotlightedParticipantsSubscribers.add(callback);
        return () => this.spotlightedParticipantsSubscribers.delete(callback);
    }

    /**
     * Get the current state of the Whereby client.
     * @return {object} - The current state of the client.
     */
    public getState() {
        return selectRoomConnectionState(this.store.getState());
    }

    /**
     * Get the event emitter for the Whereby client.
     * @return {EventEmitter} - The event emitter instance.
     */
    public getNotificationsEventEmitter() {
        return selectNotificationsEmitter(this.store.getState());
    }

    /**
     * Initialize the client with options.
     * This method can be called multiple times to update options.
     * @param options<WherebyClientOptions> - Options for the Whereby client.
     */
    public initialize(options: WherebyClientOptions) {
        this.options = options;
    }

    /**
     * Join a Whereby room.
     * This method will throw an error if the room URL is not provided.
     */
    public joinRoom() {
        const { roomUrl } = this.options;

        if (!roomUrl) {
            throw new Error("Room URL is required to join a room.");
        }

        const roomConfig = {
            localMediaOptions: this.options.localMediaOptions || undefined,
            displayName: this.options.displayName || "Guest",
            roomKey: this.options.roomKey || null,
            externalId: this.options.externalId || null,
            sdkVersion: `core:${coreVersion}`,
            roomUrl,
            assistantKey: this.options.assistantKey || null,
            isNodeSdk: this.options.isNodeSdk || false,
        };

        this.store.dispatch(doAppStart(roomConfig));
    }

    /**
     * Send a chat message to the room.
     * @param text - The message text to send.
     */
    public sendChatMessage(text: string) {
        this.store.dispatch(doSendChatMessage({ text }));
    }

    /**
     * Knock the room.
     */
    public knock() {
        this.store.dispatch(doKnockRoom());
    }

    /**
     * Leave the current room.
     * This method will reset the client state.
     */
    public leaveRoom() {
        this.store.dispatch(doAppStop());
        this.selfId = null;
    }

    /**
     * Set the display name for the local participant.
     * @param displayName - The display name to set.
     */
    public setDisplayName(displayName: string) {
        this.store.dispatch(setDisplayName({ displayName }));
    }

    /**
     * Toggle the camera on or off.
     * @param enabled - If true, enables the camera; if false, disables it.
     * If undefined, toggles the current state.
     */
    public toggleCamera(enabled?: boolean) {
        this.store.dispatch(toggleCameraEnabled({ enabled }));
    }

    /**
     * Toggle the microphone on or off.
     * @param enabled - If true, enables the microphone; if false, disables it.
     * If undefined, toggles the current state.
     */
    public toggleMicrophone(enabled?: boolean) {
        this.store.dispatch(toggleMicrophoneEnabled({ enabled }));
    }

    /**
     * Toggle low data mode on or off.
     * @param enabled - If true, enables low data mode; if false, disables it.
     * If undefined, toggles the current state.
     */
    public toggleLowDataMode(enabled?: boolean) {
        this.store.dispatch(toggleLowDataModeEnabled({ enabled }));
    }

    /**
     * Toggle raised hand.
     * @param enabled - If true, raises the hand; if false, lowers it.
     * If undefined, toggles the current state.
     */
    public toggleRaiseHand(enabled?: boolean) {
        this.store.dispatch(doSetLocalStickyReaction({ enabled }));
    }

    /**
     * Ask a participant to speak.
     * @param participantId - The ID of the participant to ask.
     */
    public askToSpeak(participantId: string) {
        this.store.dispatch(doRequestAudioEnable({ clientIds: [participantId], enable: true }));
    }

    /**
     * Ask a participant to turn on their camera.
     * @param participantId - The ID of the participant to ask.
     */
    public askToTurnOnCamera(participantId: string) {
        this.store.dispatch(doRequestVideoEnable({ clientIds: [participantId], enable: true }));
    }

    /**
     * Accept a waiting participant.
     * @param participantId - The ID of the participant to accept.
     */
    public acceptWaitingParticipant(participantId: string) {
        this.store.dispatch(doAcceptWaitingParticipant({ participantId }));
    }

    /**
     * Reject a waiting participant.
     * @param participantId - The ID of the participant to reject.
     */
    public rejectWaitingParticipant(participantId: string) {
        this.store.dispatch(doRejectWaitingParticipant({ participantId }));
    }

    /**
     * Start cloud recording.
     */
    public startCloudRecording() {
        this.store.dispatch(doStartCloudRecording());
    }

    /**
     * Stop cloud recording.
     */
    public stopCloudRecording() {
        this.store.dispatch(doStopCloudRecording());
    }

    /**
     * Start screensharing.
     */
    public startScreenshare() {
        this.store.dispatch(doStartScreenshare());
    }

    /**
     * Stop screensharing.
     */
    public stopScreenshare() {
        this.store.dispatch(doStopScreenshare());
    }

    /**
     * Lock or unlock the room.
     * @param locked - If true, locks the room; if false, unlocks it.
     */
    public lockRoom(locked: boolean) {
        this.store.dispatch(doLockRoom({ locked }));
    }

    /**
     * Mute participants.
     * @param participantIds - An array of participant IDs to mute.
     * This method will mute the specified participants.
     */
    public muteParticipants(participantIds: string[]) {
        this.store.dispatch(doRequestAudioEnable({ clientIds: participantIds, enable: false }));
    }

    /**
     * Turn off participant cameras.
     * @param participantIds - An array of participant IDs to turn off cameras for.
     * This method will turn off the specified participants' cameras.
     */
    public turnOffParticipantCameras(participantIds: string[]) {
        this.store.dispatch(doRequestVideoEnable({ clientIds: participantIds, enable: false }));
    }

    /**
     * Spotlight a participant.
     * @param participantId - The ID of the participant to spotlight.
     */
    public spotlightParticipant(participantId: string) {
        this.store.dispatch(doSpotlightParticipant({ id: participantId }));
    }

    /**
     * Remove spotlight from a participant.
     * @param participantId - The ID of the participant to remove spotlight from.
     */
    public removeSpotlight(participantId: string) {
        this.store.dispatch(doRemoveSpotlight({ id: participantId }));
    }

    /**
     * Kick a participant from the room.
     * @param participantId - The ID of the participant to kick.
     */
    public kickParticipant(participantId: string) {
        this.store.dispatch(doKickParticipant({ clientId: participantId }));
    }

    /**
     * End the meeting.
     * @param stayBehind - If true, the local participant will stay behind; if false, they will leave.
     * If undefined, defaults to false.
     */
    public endMeeting(stayBehind: boolean = false) {
        this.store.dispatch(doEndMeeting({ stayBehind }));
    }

    /**
     * Join a breakout group.
     * @param group - The ID of the breakout group to join.
     */
    public joinBreakoutGroup(group: string) {
        this.store.dispatch(doBreakoutJoin({ group }));
    }

    /**
     * Join the breakout main room.
     */
    public joinBreakoutMainRoom() {
        this.store.dispatch(doBreakoutJoin({ group: "" }));
    }

    /**
     * Report stream resolution.
     * @param streamId - The ID of the stream to report.
     * @param width - The width of the stream.
     * @param height - The height of the stream.
     */
    public reportStreamResolution(streamId: string, width: number, height: number) {
        this.store.dispatch(doRtcReportStreamResolution({ streamId, width, height }));
    }

    /**
     * Destroy the client.
     * This method will stop the app and reset the client state.
     */
    public destroy() {
        super.destroy();
        this.store.dispatch(doAppStop());
        this.removeAllListeners();
        this.selfId = null;
        this.chatMessageSubscribers.clear();
        this.cloudRecordingSubscribers.clear();
        this.breakoutSubscribers.clear();
        this.connectionStatusSubscribers.clear();
        this.liveStreamSubscribers.clear();
        this.localScreenshareStatusSubscribers.clear();
        this.localParticipantSubscribers.clear();
        this.remoteParticipantsSubscribers.clear();
        this.screenshareSubscribers.clear();
        this.waitingParticipantsSubscribers.clear();
        this.spotlightedParticipantsSubscribers.clear();
    }
}
