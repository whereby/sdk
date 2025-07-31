import { EventEmitter } from "events";
import {
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
import type { RemoteParticipantState, RoomConnectionState, WherebyClientOptions } from "./types";
import {
    BREAKOUT_CONFIG_CHANGED,
    CHAT_NEW_MESSAGE,
    CLOUD_RECORDING_STATUS_CHANGED,
    CONNECTION_STATUS_CHANGED,
    LOCAL_PARTICIPANT_JOINED,
    LOCAL_PARTICIPANT_LEFT,
    REMOTE_PARTICIPANT_CHANGED,
    REMOTE_PARTICIPANT_JOINED,
    REMOTE_PARTICIPANT_LEFT,
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

export class RoomConnectionClient extends EventEmitter<RoomConnectionEvents> {
    private store: AppStore;
    private options: WherebyClientOptions;
    private selfId: string | null = null;

    private previousState: RoomConnectionState;

    private participantsSubscribers = new Set<(participants: RemoteParticipantState[]) => void>();

    constructor(store: AppStore) {
        super();
        this.store = store;
        this.previousState = this.getState();
        this.options = {};

        this.setupEventBridge();
    }

    /**
     * Set up the event bridge to listen for store changes.
     */
    private setupEventBridge() {
        this.registerAppListeners();

        this.store.subscribe(() => {
            this.emitStateChanges();
            const currentState = this.getState();

            if (currentState === this.previousState) {
                return;
            }

            this.notifyStateSubscribers(currentState, this.previousState);
            this.previousState = currentState;
        });
    }

    private notifyStateSubscribers(currentState: RoomConnectionState, previousState: RoomConnectionState) {
        if (currentState.remoteParticipants !== previousState.remoteParticipants) {
            this.participantsSubscribers.forEach((callback) => {
                callback(currentState.remoteParticipants);
            });
        }
    }

    /**
     * Subscribe to remote participant changes.
     * @param callback - The callback to call when remote participants change.
     * @return A function to unsubscribe from the event.
     */
    public subscribeToParticipants(callback: (participants: RemoteParticipantState[]) => void): () => void {
        this.participantsSubscribers.add(callback);
        return () => this.participantsSubscribers.delete(callback);
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

    /**
     * Emit state changes based on the Redux store.
     */
    private emitStateChanges() {
        this.emitNewParticipantEvents();
        this.emitLocalParticipantEvents();
        this.emitCloudRecordingEvents();
        this.emitConnectionStateChange();
        this.emitBreakoutEvents();
        this.emitScreenshareEvents();
        this.emitWaitingParticipantEvents();
        this.emitSpotlightParticipantEvents();
        this.emitStreamingEvents();
    }

    /**
     * Emit local participant events.
     * This method listens for the local participant joining or leaving the room and emits events.
     */
    private emitLocalParticipantEvents() {
        const current = this.getState().localParticipant;
        const previous = this.previousState.localParticipant;

        if (current !== previous) {
            if (current) {
                this.emit(LOCAL_PARTICIPANT_JOINED, current);
            } else {
                this.emit(LOCAL_PARTICIPANT_LEFT, this.selfId || "unknown");
                this.selfId = null;
            }
        }
    }

    /**
     * Emit new participant events.
     * This method listens for new participants joining the room and emits events.
     */
    private emitNewParticipantEvents() {
        const current = this.getState().remoteParticipants;
        const previous = this.previousState.remoteParticipants;

        if (current === previous) {
            return;
        }

        const joined = current.filter((c) => !previous.some((p) => p.id === c.id));
        const left = previous.filter((p) => !current.some((c) => c.id === p.id));

        current.forEach((participant) => {
            if (previous.some((p) => p.id === participant.id && p !== participant)) {
                this.emit(REMOTE_PARTICIPANT_CHANGED, participant);
            }
        });

        joined.forEach((participant) => {
            this.emit(REMOTE_PARTICIPANT_JOINED, participant);
        });
        left.forEach((participant) => {
            this.emit(REMOTE_PARTICIPANT_LEFT, participant.id);
        });
    }

    /**
     * Emit cloud recording events.
     * This method listens for cloud recording events and emits them.
     * @param state - The current state of the Redux store.
     */
    private emitCloudRecordingEvents() {
        const current = this.getState().cloudRecording;
        const previous = this.previousState.cloudRecording;

        if (current !== previous) {
            this.emit(CLOUD_RECORDING_STATUS_CHANGED, current);
        }
    }

    /**
     * Emit connection state changes.
     * This method checks if the connection status has changed and emits an event if it has.
     * @param state - The current state of the Redux store.
     */
    private emitConnectionStateChange() {
        const current = this.getState().connectionStatus;
        const previous = this.previousState.connectionStatus;

        if (current !== previous) {
            this.emit(CONNECTION_STATUS_CHANGED, current);
        }
    }

    /**
     * Emit breakout events.
     * This method listens for breakout events and emits them.
     * @param state - The current state of the Redux store.
     */
    private emitBreakoutEvents() {
        const current = this.getState().breakout;
        const previous = this.previousState.breakout;

        if (current !== previous) {
            this.emit(BREAKOUT_CONFIG_CHANGED, current);
        }
    }

    /**
     * Emit screenshare events.
     * @param state - The current state of the Redux store.
     */
    private emitScreenshareEvents() {
        const current = this.getState().screenshares;
        const previous = this.previousState.screenshares;

        if (current !== previous) {
            const joined = current.filter((c) => !previous.some((p) => p.id === c.id));
            const left = previous.filter((p) => !current.some((c) => c.id === p.id));

            joined.forEach((screenshare) => {
                this.emit(SCREENSHARE_STARTED, screenshare);
            });

            left.forEach((screenshare) => {
                this.emit(SCREENSHARE_STOPPED, screenshare.id);
            });
        }
    }

    /**
     * Emit waiting participant events.
     * @param state - The current state of the Redux store.
     */
    private emitWaitingParticipantEvents() {
        const current = this.getState().waitingParticipants;
        const previous = this.previousState.waitingParticipants;

        if (current.length === previous.length) {
            return;
        }

        const joined = current.filter((c) => !previous.some((p) => p.id === c.id));
        const left = previous.filter((p) => !current.some((c) => c.id === p.id));

        joined.forEach((participant) => {
            this.emit(WAITING_PARTICIPANT_JOINED, participant);
        });
        left.forEach((participant) => {
            this.emit(WAITING_PARTICIPANT_LEFT, participant.id);
        });
    }

    /**
     * Emit spotlight participant events.
     * @param state - The current state of the Redux store.
     */
    private emitSpotlightParticipantEvents() {
        const current = this.getState().spotlightedParticipants;
        const previous = this.previousState.spotlightedParticipants;

        if (current.length === previous.length) {
            return;
        }

        const added = current.filter((c) => !previous.some((p) => p.id === c.id));
        const removed = previous.filter((p) => !current.some((c) => c.id === p.id));

        added.forEach((participant) => {
            this.emit(SPOTLIGHT_PARTICIPANT_ADDED, participant);
        });
        removed.forEach((participant) => {
            this.emit(SPOTLIGHT_PARTICIPANT_REMOVED, participant.id);
        });
    }

    /**
     * Emit streaming events.
     * @param state - The current state of the Redux store.
     */
    private emitStreamingEvents() {
        const current = this.getState().liveStream;
        const previous = this.previousState.liveStream;

        if (current !== previous) {
            if (current?.status === "streaming") {
                this.emit(STREAMING_STARTED, current);
            } else {
                this.emit(STREAMING_STOPPED);
            }
        }
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
            localMediaOptions: this.options.localMediaOptions || {
                audio: true,
                video: true,
            },
            displayName: this.options.displayName || "Guest",
            roomKey: this.options.roomKey || null,
            externalId: this.options.externalId || null,
            sdkVersion: `core:${coreVersion}`,
            roomUrl,
        };

        this.store.dispatch(doAppStart(roomConfig));
    }

    /**
     * Send a chat message to the room.
     * @param text - The message text to send.
     */
    public sendChatMessage(text: string) {
        this.store.dispatch(doSendChatMessage({ text }));
        //this.emit("chatMessageSent", text);
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
        this.store.dispatch(doAppStop());
        this.removeAllListeners();
        this.selfId = null;
    }
}
