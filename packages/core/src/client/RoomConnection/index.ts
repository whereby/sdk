import { addListener } from "@reduxjs/toolkit";

import {
    ClientView,
    ConnectionStatus,
    JoinRoomErrorNames,
    JoinRoomStage,
    doAcceptWaitingParticipant,
    doAppStart,
    doAppStop,
    doOrganizationFetch,
    doCancelKnock,
    doBreakoutJoin,
    doStartBreakoutSession,
    doUpdateBreakoutSession,
    doStopBreakoutSession,
    doAssignBreakoutParticipants,
    doAssignAllBreakoutParticipants,
    doUnassignAllBreakoutParticipants,
    doShuffleBreakoutParticipants,
    doExtendBreakoutTimer,
    doStopBreakoutTimer,
    doEndMeeting,
    doHoldWaitingParticipant,
    doKickParticipant,
    doKnockRoom,
    doLockRoom,
    doRejectWaitingParticipant,
    doRemoveSpotlight,
    doRequestAudioEnable,
    doRequestVideoEnable,
    doRtcReportStreamResolution,
    doSendChatMessage,
    doToggleAudioOnlyMode,
    doRemoveChatMessage,
    doSendFiles,
    doDownloadFile,
    doSetLocalStickyReaction,
    doSpotlightParticipant,
    doStartCloudRecording,
    doStartLiveCaptions,
    doStartLiveTranscription,
    doStartScreenshare,
    doStopCloudRecording,
    doStopLiveCaptions,
    doStopLiveTranscription,
    doStopScreenshare,
    doRequestScreenshareEnable,
    doStartRoomIntegration,
    doStopRoomIntegration,
    doUpdateRoomIntegrationProps,
    selectNotificationsEmitter,
    setDisplayName,
    signalEvents,
    roomRejoined,
    StartBreakoutSessionOptions,
    UpdateBreakoutSessionOptions,
    startAppListening,
    toggleCameraEnabled,
    toggleHdModeEnabled,
    toggleLowDataModeEnabled,
    toggleWidescreenModeEnabled,
    toggleMicrophoneEnabled,
    AppConfig,
    ToggleAudioOnlyModeOptions,
} from "../../redux";
import type { Store as AppStore } from "../../redux/store";
import type {
    BreakoutState,
    RemoteParticipantQualityReport,
    LocalParticipantQualityReport,
    ChatFileShare,
    ChatMessage,
    CloudRecordingState,
    FileUpload,
    LiveCaptionsState,
    LiveTranscriptionState,
    LocalParticipantState,
    LocalScreenshareStatus,
    LocalScreenshareState,
    KnockResponse,
    RemoteParticipantState,
    RoomConnectionState,
    RoomIntegrationsState,
    RoomIntegrationProps,
    RoomJoinedSuccess,
    SendFilesOptions,
    ScreenshareState,
    WaitingParticipantState,
    WherebyClientOptions,
} from "./types";
import { CHAT_NEW_MESSAGE, ROOM_JOINED, ROOM_JOINED_ERROR, ROOM_REJOINED, type RoomConnectionEvents } from "./events";
import { roomConnectionStateDefinition } from "./state";
import { BaseClient } from "../BaseClient";
import { doCameraEffectsSwitchPreset } from "../../redux/slices/cameraEffects";
import { doAudioDenoiserDisable, doAudioDenoiserEnable } from "../../redux/slices/audioDenoiser";

export class RoomConnectionClient extends BaseClient<RoomConnectionState, RoomConnectionEvents> {
    protected options: Partial<AppConfig>;
    private selfId: string | null = null;

    constructor(store: AppStore) {
        super(store, roomConnectionStateDefinition);
        this.options = {};
        this.registerAppListeners();
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
            actionCreator: roomRejoined,
            effect: ({ payload }) => {
                const { selfId, previousSelfId } = payload;
                this.emit(ROOM_REJOINED, {
                    selfId,
                    previousSelfId,
                    selfIdChanged: selfId !== previousSelfId,
                });
            },
        });

        startAppListening({
            actionCreator: signalEvents.chatMessage,
            effect: ({ payload }) => {
                this.emit(CHAT_NEW_MESSAGE, {
                    ...payload,
                    removed: false,
                });
            },
        });
    }

    /* Subscriptions */
    public subscribeToChatMessages(callback: (messages: ChatMessage[]) => void): () => void {
        return this.subscribeToStateKey("chatMessages", callback);
    }

    public subscribeToFileUploads(callback: (uploads: FileUpload[]) => void): () => void {
        return this.subscribeToStateKey("fileUploads", callback);
    }

    public subscribeToCloudRecording(callback: (status: CloudRecordingState | undefined) => void): () => void {
        return this.subscribeToStateKey("cloudRecording", callback);
    }

    public subscribeToLiveCaptions(callback: (status: LiveCaptionsState | undefined) => void): () => void {
        return this.subscribeToStateKey("liveCaptions", callback);
    }

    public subscribeToLiveTranscription(callback: (status: LiveTranscriptionState | undefined) => void): () => void {
        return this.subscribeToStateKey("liveTranscription", callback);
    }

    public subscribeToBreakoutConfig(callback: (config: BreakoutState) => void): () => void {
        return this.subscribeToStateKey("breakout", callback);
    }

    public subscribeToConnectionStatus(callback: (status: ConnectionStatus) => void): () => void {
        return this.subscribeToStateKey("connectionStatus", callback);
    }

    public subscribeToConnectionError(callback: (error: string | null) => void): () => void {
        return this.subscribeToStateKey("connectionError", callback);
    }

    public subscribeToJoinStage(callback: (joinStage: JoinRoomStage | null) => void): () => void {
        return this.subscribeToStateKey("joinStage", callback);
    }

    /**
     * Subscribe to the host's response to knocking, which is null until there is one.
     */
    public subscribeToKnockResponse(callback: (knockResponse: KnockResponse | null) => void): () => void {
        return this.subscribeToStateKey("knockResponse", callback);
    }

    public subscribeToRoomSessionId(callback: (roomSessionId: string | null) => void): () => void {
        return this.subscribeToStateKey("roomSessionId", callback);
    }

    public subscribeToAudioOnlyMode(callback: (isEnabled: boolean) => void): () => void {
        return this.subscribeToStateKey("isAudioOnlyModeEnabled", callback);
    }

    /**
     * Subscribe to remote participant quality report changes.
     *
     * The report is keyed by `clientId` and has an entry for each remote client (not the local client).
     * Each entry has a `quality` level (`"ok"`, `"warning"` or `"critical"`), which is the worst of the
     * client's video and audio quality. The report is empty until the call quality monitor starts after
     * joining a room, and is reset to empty after leaving.
     *
     * @param callback - Called with the latest report whenever it changes.
     * @returns A function that removes the subscription.
     */
    public subscribeToRemoteParticipantQualityReport(
        callback: (report: RemoteParticipantQualityReport) => void,
    ): () => void {
        return this.subscribeToStateKey("remoteParticipantQualityReport", callback);
    }

    /**
     * Subscribe to local participant quality report changes.
     *
     * The report has a `quality` level (`"ok"`, `"warning"` or `"critical"`), which is the worst of the
     * local client's video and audio quality, and a `cpu` level (`"ok"`, `"warning"` or `"critical"`) for
     * the local device's CPU pressure. `cpu` is left out when the browser can't measure CPU pressure (it
     * needs the Compute Pressure API). The report is empty until the call quality monitor starts after
     * joining a room, and is reset to empty after leaving.
     *
     * @param callback - Called with the latest report whenever it changes.
     * @returns A function that removes the subscription.
     */
    public subscribeToLocalParticipantQualityReport(
        callback: (report: LocalParticipantQualityReport) => void,
    ): () => void {
        return this.subscribeToStateKey("localParticipantQualityReport", callback);
    }

    public subscribeToLiveStream(callback: (status: { status: "streaming" } | undefined) => void): () => void {
        return this.subscribeToStateKey("liveStream", callback);
    }

    /**
     * @deprecated Use 'subscribeToLocalScreenshare' instead
     */
    public subscribeToLocalScreenshareStatus(callback: (status?: LocalScreenshareStatus) => void): () => void {
        return this.subscribeToStateKey("localScreenshareStatus", callback);
    }

    public subscribeToLocalScreenshare(callback: (status: LocalScreenshareState | undefined) => void): () => void {
        return this.subscribeToStateKey("localScreenshare", callback);
    }

    public subscribeToLocalParticipant(callback: (participant?: LocalParticipantState) => void): () => void {
        return this.subscribeToStateKey("localParticipant", callback);
    }

    public subscribeToRemoteParticipants(callback: (participants: RemoteParticipantState[]) => void): () => void {
        return this.subscribeToStateKey("remoteParticipants", callback);
    }

    public subscribeToScreenshares(callback: (screenshares: ScreenshareState[]) => void): () => void {
        return this.subscribeToStateKey("screenshares", callback);
    }

    public subscribeToWaitingParticipants(callback: (participants: WaitingParticipantState[]) => void): () => void {
        return this.subscribeToStateKey("waitingParticipants", callback);
    }

    public subscribeToSpotlightedParticipants(callback: (participants: ClientView[]) => void): () => void {
        return this.subscribeToStateKey("spotlightedParticipants", callback);
    }

    public subscribeToMicrophoneState(callback: (isMicrophoneEnabled: boolean) => void): () => void {
        return this.subscribeToStateKey("isMicrophoneEnabled", callback);
    }

    public subscribeToCameraState(callback: (isCameraEnabled: boolean) => void): () => void {
        return this.subscribeToStateKey("isCameraEnabled", callback);
    }

    public subscribeToRoomIntegrations(callback: (roomIntegrations: RoomIntegrationsState) => void): () => void {
        return this.subscribeToStateKey("roomIntegrations", callback);
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
     * The promise rejects if the room URL is not provided, if the room can't be joined, and with `"join_cancelled"`
     * when the room is left or joined again before this join has finished.
     */
    public joinRoom(): Promise<RoomJoinedSuccess> {
        const { roomUrl } = this.options;

        if (!roomUrl) {
            return Promise.reject(new Error("Room URL is required to join a room."));
        }

        const roomConfig: AppConfig = {
            localMediaOptions: this.options.localMediaOptions || undefined,
            initialMuteStates: this.options.initialMuteStates || undefined,
            displayName: this.options.displayName || "Guest",
            roomKey: this.options.roomKey || null,
            externalId: this.options.externalId || null,
            roomUrl,
            assistantKey: this.options.assistantKey || null,
            isNodeSdk: this.options.isNodeSdk || false,
            isAudioRecorder: this.options.isAudioRecorder ?? false,
            isDialIn: this.options.isDialIn ?? false,
        };

        this.store.dispatch(doAppStart(roomConfig));

        let resolve: (value: RoomJoinedSuccess | PromiseLike<RoomJoinedSuccess>) => void;
        let reject: (reason: unknown) => void;
        const promise = new Promise<RoomJoinedSuccess>((res, rej) => {
            resolve = res;
            reject = rej;
        });

        const unsubscribeRoomJoined = this.store.dispatch(
            addListener({
                actionCreator: signalEvents.roomJoined,
                effect: ({ payload }) => {
                    stopListening();

                    if ("error" in payload) {
                        reject?.(payload.error);
                        return;
                    }

                    resolve?.(payload);
                },
            }),
        );

        // Without the organization the room is never joined, so roomJoined would never arrive.
        const unsubscribeOrganizationFetchFailed = this.store.dispatch(
            addListener({
                actionCreator: doOrganizationFetch.rejected,
                effect: () => {
                    stopListening();

                    reject?.("organization_fetch_failed" satisfies JoinRoomErrorNames);
                },
            }),
        );

        const unsubscribeJoinCancelled = this.store.dispatch(
            addListener({
                predicate: (action) => doAppStop.match(action) || doAppStart.match(action),
                effect: () => {
                    stopListening();

                    promise.catch(() => undefined);
                    reject?.("join_cancelled" satisfies JoinRoomErrorNames);
                },
            }),
        );

        const stopListening = () => {
            unsubscribeRoomJoined();
            unsubscribeOrganizationFetchFailed();
            unsubscribeJoinCancelled();
        };

        return promise;
    }

    /**
     * Send a chat message to the room.
     * @param text - The message text to send.
     * @param parentId - Optional id of the message this is a reply to.
     * @param isBroadcast - When true and a breakout session is active, the message is broadcast to all
     * breakout groups instead of only the sender's group.
     */
    public sendChatMessage(text: string, parentId?: string, isBroadcast?: boolean) {
        this.store.dispatch(doSendChatMessage({ text, parentId, isBroadcast }));
    }

    /**
     * Remove a chat message from the room.
     * @param id - The message id to remove.
     * @param sig - The message signature to use to authorize removal.
     */
    public removeChatMessage(id: string, sig?: string | null) {
        this.store.dispatch(doRemoveChatMessage({ id, sig }));
    }

    /**
     * Upload files and share them with the room as chat messages. Each file is shared as its own
     * chat message, so replying with both text and files means calling
     * {@link RoomConnectionClient.sendChatMessage} and this method with the same `parentId`.
     * @param files - The files to share.
     * @param options.parentId - Optional id of the message the files are a reply to.
     * @param options.isBroadcast - When true and a breakout session is active, the files are broadcast
     * to all breakout groups instead of only the sender's group.
     */
    public sendFiles(files: File[], options?: SendFilesOptions) {
        this.store.dispatch(doSendFiles({ files, ...options }));
    }

    /**
     * Download a shared file. Resolves with the file contents as a Blob
     * @param file - The shared file to download.
     */
    public downloadFile(file: ChatFileShare): Promise<Blob> {
        return this.store.dispatch(doDownloadFile({ file })).unwrap();
    }

    /**
     * Knock the room.
     */
    public knock() {
        this.store.dispatch(doKnockRoom());
    }

    /**
     * Cancel the knock request.
     */
    public cancelKnock() {
        this.store.dispatch(doCancelKnock());
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
     * Toggle video hd mode on or off.
     * @param enabled - If true, enables hd mode; if false, disables it.
     * If undefined, toggles the current state.
     */
    public toggleHdMode(enabled?: boolean) {
        this.store.dispatch(toggleHdModeEnabled({ enabled }));
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
     * Toggle audio-only mode on or off. While enabled, all incoming video is paused and only audio is received.
     * @param enabled - If true, enables audio-only mode; if false, disables it.
     * If undefined, toggles the current state.
     * @param options - Optional settings for audio-only mode.
     * @param options.autoDisableLocalCamera - If true, also turns off the local camera when enabling audio-only mode.
     * The camera is not turned back on when audio-only mode is disabled.
     */
    public toggleAudioOnlyMode(enabled?: boolean, options?: ToggleAudioOnlyModeOptions) {
        this.store.dispatch(doToggleAudioOnlyMode({ enabled, ...options }));
    }

    /**
     * Toggle video widescreen mode on or off.
     * @param enabled - If true, enables widescreen mode; if false, disables it.
     * If undefined, toggles the current state.
     */
    public toggleWidescreenMode(enabled?: boolean) {
        this.store.dispatch(toggleWidescreenModeEnabled({ enabled }));
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
     * Ask a participant to share their screen.
     * @param participantId - The ID of the participant to ask.
     */
    public askToTurnOnScreenshare(participantId: string) {
        this.store.dispatch(doRequestScreenshareEnable({ clientId: participantId, enable: true }));
    }

    /**
     * Accept a waiting participant.
     * @param participantId - The ID of the participant to accept.
     */
    public acceptWaitingParticipant(participantId: string) {
        this.store.dispatch(doAcceptWaitingParticipant({ participantId }));
    }

    /**
     * Put a waiting participant on hold, optionally sending them a message.
     * The participant remains in the waiting room.
     * @param participantId - The ID of the participant to put on hold.
     * @param response - An optional message to show the waiting participant.
     */
    public holdWaitingParticipant(participantId: string, response?: string) {
        this.store.dispatch(doHoldWaitingParticipant({ participantId, response }));
    }

    /**
     * Reject a waiting participant, optionally sending them a message.
     * @param participantId - The ID of the participant to reject.
     * @param response - An optional message to show the rejected participant.
     */
    public rejectWaitingParticipant(participantId: string, response?: string) {
        this.store.dispatch(doRejectWaitingParticipant({ participantId, response }));
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
     * Start live transcription.
     */
    public startLiveTranscription() {
        this.store.dispatch(doStartLiveTranscription());
    }

    /**
     * Stop live transcription.
     */
    public stopLiveTranscription() {
        this.store.dispatch(doStopLiveTranscription());
    }

    /**
     * Start live captions.
     */
    public startLiveCaptions() {
        this.store.dispatch(doStartLiveCaptions());
    }

    /**
     * Stop live captions.
     */
    public stopLiveCaptions() {
        this.store.dispatch(doStopLiveCaptions());
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
     * Stop participant screenshare.
     * @param participantId - The ID of the participant to stop screensharing.
     */
    public stopParticipantScreenshare(participantId: string) {
        this.store.dispatch(doRequestScreenshareEnable({ clientId: participantId, enable: false }));
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
     * Share a room integration with everyone in the room, or in the current breakout group.
     *
     * The integration must be enabled for the room. `tagName` and `props` come from the integration's
     * own bootstrap: they describe which content element to render and with which attributes.
     *
     * @param options.roomIntegrationId - The integration to start.
     * @param options.tagName - Custom element name for the content frame.
     * @param options.shareUrl - The https url of the shared content.
     * @param options.props - Optional props to pass to the content frame.
     */
    public startRoomIntegration(options: {
        roomIntegrationId: string;
        tagName: string;
        shareUrl: string;
        props?: RoomIntegrationProps;
    }) {
        this.store.dispatch(doStartRoomIntegration(options));
    }

    /**
     * Stop a running room integration.
     *
     * @param options.roomIntegrationSessionId - The running session to stop.
     * @param options.intent - "end" when the user deliberately ended it, otherwise "stop".
     */
    public stopRoomIntegration(options: { roomIntegrationSessionId: string; intent?: "stop" | "end" }) {
        this.store.dispatch(doStopRoomIntegration(options));
    }

    /**
     * Update the props of a running room integration, propagating them to everyone in the room.
     * This is how integration state such as playback position is kept in sync.
     *
     * @param options.roomIntegrationSessionId - The running session to update.
     * @param options.props - Partial patch, merged into the session's existing props.
     */
    public updateRoomIntegrationProps(options: { roomIntegrationSessionId: string; props: RoomIntegrationProps }) {
        this.store.dispatch(doUpdateRoomIntegrationProps(options));
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
     * Start a breakout session. Requires host privileges.
     * @param options - The groups, optional participant assignments and session settings.
     */
    public startBreakoutSession(options: StartBreakoutSessionOptions) {
        this.store.dispatch(doStartBreakoutSession(options));
    }

    /**
     * Update an ongoing breakout session's groups and/or settings. Requires host privileges.
     * @param options - The groups, participant assignments and session settings to update.
     */
    public updateBreakoutSession(options: UpdateBreakoutSessionOptions) {
        this.store.dispatch(doUpdateBreakoutSession(options));
    }

    /**
     * Stop the ongoing breakout session. Requires host privileges.
     */
    public stopBreakoutSession() {
        this.store.dispatch(doStopBreakoutSession());
    }

    /**
     * Assign participants to breakout groups. Requires host privileges.
     * @param assignments - A map of participant `clientId -> groupId`. Merged with the current
     * assignments (participants not included keep theirs); an empty `groupId` unassigns the participant.
     */
    public assignBreakoutParticipants(assignments: { [clientId: string]: string }) {
        this.store.dispatch(doAssignBreakoutParticipants({ assignments }));
    }

    /**
     * Randomly distribute all remote participants across the breakout groups. Requires host privileges.
     */
    public assignAllBreakoutParticipants() {
        this.store.dispatch(doAssignAllBreakoutParticipants());
    }

    /**
     * Clear all breakout group assignments. Requires host privileges.
     */
    public unassignAllBreakoutParticipants() {
        this.store.dispatch(doUnassignAllBreakoutParticipants());
    }

    /**
     * Re-shuffle the currently-assigned participants across the breakout groups. Requires host privileges.
     */
    public shuffleBreakoutParticipants() {
        this.store.dispatch(doShuffleBreakoutParticipants());
    }

    /**
     * Extend the running breakout timer. Requires host privileges.
     * @param seconds - Number of seconds to add (default 60).
     */
    public extendBreakoutTimer(seconds?: number) {
        this.store.dispatch(doExtendBreakoutTimer({ seconds }));
    }

    /**
     * Stop the running breakout timer (the session itself stays active). Requires host privileges.
     */
    public stopBreakoutTimer() {
        this.store.dispatch(doStopBreakoutTimer());
    }

    /**
     * Broadcast a main-room participant's audio/video into all breakout groups. This spotlights the
     * participant; during an active breakout the SFU routes their stream into every group. Requires
     * host privileges.
     * @param participantId - The clientId of the participant to broadcast.
     */
    public broadcastToGroups(participantId: string) {
        this.store.dispatch(doSpotlightParticipant({ id: participantId }));
    }

    /**
     * Stop broadcasting a participant into the breakout groups (removes their spotlight). Requires
     * host privileges.
     * @param participantId - The clientId of the participant to stop broadcasting.
     */
    public stopBroadcastToGroups(participantId: string) {
        this.store.dispatch(doRemoveSpotlight({ id: participantId }));
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
     * Replace the local stream with a new effect stream.
     * @param effectId - The ID of the effect to use.
     */
    public async switchCameraEffect(effectId: string): Promise<void> {
        try {
            await this.store.dispatch(doCameraEffectsSwitchPreset({ effectId }));
        } catch (error) {
            return Promise.reject(error);
        }

        return Promise.resolve();
    }

    /**
     * Replace the local stream with a custom image effect stream.
     * @param imageUrl - The URL of the custom image to use as the background. This needs to be a base64 encoded image or a URL accessible from the browser.
     */

    public async switchCameraEffectCustom(imageUrl: string): Promise<void> {
        try {
            await this.store.dispatch(
                doCameraEffectsSwitchPreset({
                    effectId: "image-custom",
                    backgroundUrl: imageUrl,
                }),
            );
        } catch (error) {
            return Promise.reject(error);
        }

        return Promise.resolve();
    }

    /**
     * Remove the effect stream and revert to the original local stream.
     */
    public async clearCameraEffect(): Promise<void> {
        try {
            await this.store.dispatch(doCameraEffectsSwitchPreset({ effectId: null }));
        } catch (error) {
            return Promise.reject(error);
        }

        return Promise.resolve();
    }

    /**
     * Enable audio noise suppression on the local microphone stream. The
     * denoiser is automatically reapplied if the microphone device is later
     * switched. The denoiser code is loaded on demand the first time it is
     * enabled.
     */
    public async enableAudioDenoiser(): Promise<void> {
        try {
            await this.store.dispatch(doAudioDenoiserEnable());
        } catch (error) {
            return Promise.reject(error);
        }
        return Promise.resolve();
    }

    /**
     * Disable audio noise suppression and revert to the raw microphone stream.
     */
    public async disableAudioDenoiser(): Promise<void> {
        try {
            await this.store.dispatch(doAudioDenoiserDisable());
        } catch (error) {
            return Promise.reject(error);
        }
        return Promise.resolve();
    }

    /**
     * Stops the app and resets the client state when the client is destroyed.
     */
    protected onDestroy() {
        this.store.dispatch(doAppStop());
        this.selfId = null;
    }
}
