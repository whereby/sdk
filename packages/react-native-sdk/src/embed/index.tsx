import * as React from "react";
import { WebView, WebViewMessageEvent, WebViewProps } from "react-native-webview";

type SettingsPane = "theme" | "integrations" | "streaming" | "effects" | "notifications" | "advanced" | "media" | null;

function getInjectableJSMessage(command: string, args: unknown[]) {
    const parsedArgs = args.length === 1 && args[0] === undefined ? "" : `, args: ${JSON.stringify(args)}`;
    return `(function() { window.postMessage({ command: ${JSON.stringify(command)}${parsedArgs} }) })()`;
}

interface WherebyEmbedElementAttributes {
    aec?: string;
    agc?: string;
    audio?: string;
    /**
     * Automatically spotlight the local participant on room join. Can only be used with users joining with host privileges.
     */
    audioDenoiser?: string;
    autoHideSelfView?: string;
    autoSpotlight?: string;
    avatarUrl?: string;
    background?: string;
    bottomToolbar?: string;
    breakout?: string;
    callQualityMonitoring?: string;
    cameraAccess?: string;
    cameraEffect?: string;
    chat?: string;
    displayName?: string;
    emptyRoomInvitation?: string;
    emojiSkinTone?: string;
    externalId?: string;
    floatSelf?: string;
    groups?: string;
    help?: string;
    lang?: string;
    leaveButton?: string;
    locking?: string;
    localization?: string;
    logo?: string;
    lowData?: string;
    metadata?: string;
    minimal?: string;
    moreButton?: string;
    participantCount?: string;
    people?: string;
    pipButton?: string;
    /**
     * Displays a device and connectivity test for the user. Is dependent on precallReview being enabled
     */
    precallCeremony?: string;
    precallReview?: string;
    precallPermissionsHelpLink?: string;
    precallCeremonyCanSkip?: string;
    reactions?: string;
    recording?: string;
    room?: string;
    /**
     * Enables the use of supported room integrations (Miro and YouTube)
     */
    roomIntegrations?: string;
    settingsButton?: string;
    screenshare?: string;
    /**
     * Skips the Whereby permissions UI and causes browser to automatically request device permissions. Required for Android app integrations.
     */
    skipMediaPermissionPrompt?: string;
    subgridLabels?: string;
    timer?: string;
    title?: string;
    /**
     * Use dark text for bottom toolbar items.
     *
     * Use this attribute when the room background is light and the bottom toolbar items are hard to read.
     */
    toolbarDarkText?: string;
    topToolbar?: string;
    video?: string;
    virtualBackgroundUrl?: string;
}

interface PrecallCheckCompletedStepResult {
    status: "passed" | "failed";
}

const WHEREBY_EVENT_TYPES = [
    "ready",
    "knock",
    "participantupdate",
    "join",
    "leave",
    "participant_join",
    "participant_leave",
    "meeting_end",
    "microphone_toggle",
    "camera_toggle",
    "chat_toggle",
    "people_toggle",
    "pip_toggle",
    "grant_device_permission",
    "deny_device_permission",
    "screenshare_toggle",
    "streaming_status_change",
    "connection_status_change",
    "precall_check_skipped",
    "precall_check_completed",
];

export type WherebyEvent =
    | { type: "ready"; payload: undefined }
    | { type: "knock"; payload: undefined }
    | { type: "participantupdate"; payload: { count: number } }
    | { type: "join"; payload: undefined }
    | { type: "leave"; payload: { removed: boolean } }
    | { type: "participant_join"; payload: { participant: { metadata: string | null; externalId: string | null } } }
    | { type: "participant_leave"; payload: { participant: { metadata: string | null; externalId: string | null } } }
    | { type: "meeting_end"; payload: undefined }
    | { type: "microphone_toggle"; payload: { enabled: boolean } }
    | { type: "camera_toggle"; payload: { enabled: boolean } }
    | { type: "chat_toggle"; payload: { open: boolean } }
    | { type: "people_toggle"; payload: { open: boolean } }
    | { type: "pip_toggle"; payload: { open: boolean } }
    | { type: "grant_device_permission"; payload: { granted: boolean } }
    | { type: "deny_device_permission"; payload: { denied: boolean } }
    | { type: "screenshare_toggle"; payload: { enabled: boolean } }
    | { type: "streaming_status_change"; payload: { status: string } }
    | { type: "connection_status_change"; payload: { status: "stable" | "unstable" } }
    | { type: "precall_check_skipped"; payload: undefined }
    | {
          type: "precall_check_completed";
          payload: {
              status: "passed" | "failed";
              steps: {
                  camera: PrecallCheckCompletedStepResult;
                  speaker: PrecallCheckCompletedStepResult;
                  microphone: PrecallCheckCompletedStepResult;
                  bandwidth: PrecallCheckCompletedStepResult;
              };
          };
      };

type WherebyWebView = WebView & {
    endMeeting: () => void;
    knock: () => void;
    leaveRoom: () => void;
    openSettings: (settingsPane?: SettingsPane) => void;
    startRecording: () => void;
    stopRecording: () => void;
    startStreaming: () => void;
    stopStreaming: () => void;
    startLiveTranscription: () => void;
    stopLiveTranscription: () => void;
    toggleBreakout: (enabled?: boolean) => void;
    toggleCamera: (enabled?: boolean) => void;
    toggleMicrophone: (enabled?: boolean) => void;
    togglePeople: (enabled?: boolean) => void;
    toggleScreenshare: (enabled?: boolean) => void;
    toggleChat: (enabled?: boolean) => void;
};

interface WherebyEmbedProps extends WebViewProps, WherebyEmbedElementAttributes {
    room: string;
    // Catch-all for any Whereby event
    onWherebyMessage?: (data: WherebyEvent) => void;
    // Specific callbacks for each Whereby event
    onReady?: () => void;
    onKnock?: () => void;
    onParticipantUpdate?: (data: Extract<WherebyEvent, { type: "participantupdate" }>["payload"]) => void;
    onJoin?: () => void;
    onLeave?: (data: Extract<WherebyEvent, { type: "leave" }>["payload"]) => void;
    onParticipantJoin?: (data: Extract<WherebyEvent, { type: "participant_join" }>["payload"]) => void;
    onParticipantLeave?: (data: Extract<WherebyEvent, { type: "participant_leave" }>["payload"]) => void;
    onMeetingEnd?: () => void;
    onMicrophoneToggle?: (data: Extract<WherebyEvent, { type: "microphone_toggle" }>["payload"]) => void;
    onCameraToggle?: (data: Extract<WherebyEvent, { type: "camera_toggle" }>["payload"]) => void;
    onChatToggle?: (data: Extract<WherebyEvent, { type: "chat_toggle" }>["payload"]) => void;
    onPeopleToggle?: (data: Extract<WherebyEvent, { type: "people_toggle" }>["payload"]) => void;
    onPipToggle?: (data: Extract<WherebyEvent, { type: "pip_toggle" }>["payload"]) => void;
    onGrantDevicePermission?: (data: Extract<WherebyEvent, { type: "grant_device_permission" }>["payload"]) => void;
    onDenyDevicePermission?: (data: Extract<WherebyEvent, { type: "deny_device_permission" }>["payload"]) => void;
    onScreenshareToggle?: (data: Extract<WherebyEvent, { type: "screenshare_toggle" }>["payload"]) => void;
    onStreamingStatusChange?: (data: Extract<WherebyEvent, { type: "streaming_status_change" }>["payload"]) => void;
    onConnectionStatusChange?: (data: Extract<WherebyEvent, { type: "connection_status_change" }>["payload"]) => void;
    onPrecallCheckSkipped?: () => void;
    onPrecallCheckCompleted?: (data: Extract<WherebyEvent, { type: "precall_check_completed" }>["payload"]) => void;
}

const WherebyEmbed = React.forwardRef<WherebyWebView, WherebyEmbedProps>(
    ({ room, ...props }: WherebyEmbedProps, ref) => {
        const webviewRef = React.useRef<WebView>(null);
        const roomUrl = new URL(room);

        Object.entries({
            ...(props.displayName && { displayName: props.displayName }),
            ...(props.lang && { lang: props.lang }),
            ...(props.metadata && { metadata: props.metadata }),
            ...(props.emojiSkinTone && { emojiSkinTone: props.emojiSkinTone }),
            ...(props.externalId && { externalId: props.externalId }),
            ...(props.groups && { groups: props.groups }),
            ...(props.virtualBackgroundUrl && { virtualBackgroundUrl: props.virtualBackgroundUrl }),
            ...(props.avatarUrl && { avatarUrl: props.avatarUrl }),
            ...(props.cameraEffect && { cameraEffect: props.cameraEffect }),
            // the original ?embed name was confusing, so we give minimal
            ...(props.minimal != null && { embed: props.minimal }),
            ...(props.aec != null && { aec: props.aec }),
            ...(props.agc != null && { agc: props.agc }),
            ...(props.audio != null && { audio: props.audio }),
            ...(props.audioDenoiser != null && { audioDenoiser: props.audioDenoiser }),
            ...(props.autoHideSelfView != null && { autoHideSelfView: props.autoHideSelfView }),
            ...(props.autoSpotlight != null && { autoSpotlight: props.autoSpotlight }),
            ...(props.background != null && { background: props.background }),
            ...(props.bottomToolbar != null && { bottomToolbar: props.bottomToolbar }),
            ...(props.breakout != null && { breakout: props.breakout }),
            ...(props.callQualityMonitoring != null && { callQualityMonitoring: props.callQualityMonitoring }),
            ...(props.cameraAccess != null && { cameraAccess: props.cameraAccess }),
            ...(props.cameraEffect != null && { cameraEffect: props.cameraEffect }),
            ...(props.chat != null && { chat: props.chat }),
            ...(props.displayName != null && { displayName: props.displayName }),
            ...(props.emptyRoomInvitation != null && { emptyRoomInvitation: props.emptyRoomInvitation }),
            ...(props.emojiSkinTone != null && { emojiSkinTone: props.emojiSkinTone }),
            ...(props.externalId != null && { externalId: props.externalId }),
            ...(props.floatSelf != null && { floatSelf: props.floatSelf }),
            ...(props.groups != null && { groups: props.groups }),
            ...(props.help != null && { help: props.help }),
            ...(props.lang != null && { lang: props.lang }),
            ...(props.leaveButton != null && { leaveButton: props.leaveButton }),
            ...(props.locking != null && { locking: props.locking }),
            ...(props.localization != null && { localization: props.localization }),
            ...(props.logo != null && { logo: props.logo }),
            ...(props.lowData != null && { lowData: props.lowData }),
            ...(props.moreButton != null && { moreButton: props.moreButton }),
            ...(props.participantCount != null && { participantCount: props.participantCount }),
            ...(props.people != null && { people: props.people }),
            ...(props.pipButton != null && { pipButton: props.pipButton }),
            ...(props.precallCeremony != null && { precallCeremony: props.precallCeremony }),
            ...(props.precallReview != null && { precallReview: props.precallReview }),
            ...(props.precallPermissionsHelpLink != null && {
                precallPermissionsHelpLink: props.precallPermissionsHelpLink,
            }),
            ...(props.precallCeremonyCanSkip != null && { precallCeremonyCanSkip: props.precallCeremonyCanSkip }),
            ...(props.reactions != null && { reactions: props.reactions }),
            ...(props.recording != null && { recording: props.recording }),
            ...(props.roomIntegrations != null && { roomIntegrations: props.roomIntegrations }),
            ...(props.settingsButton != null && { settingsButton: props.settingsButton }),
            ...(props.screenshare != null && { screenshare: props.screenshare }),
            ...(props.skipMediaPermissionPrompt != null && {
                skipMediaPermissionPrompt: props.skipMediaPermissionPrompt,
            }),
            ...(props.subgridLabels != null && { subgridLabels: props.subgridLabels }),
            ...(props.timer != null && { timer: props.timer }),
            ...(props.title != null && { title: props.title }),
            ...(props.toolbarDarkText != null && { toolbarDarkText: props.toolbarDarkText }),
            ...(props.topToolbar != null && { topToolbar: props.topToolbar }),
            ...(props.video != null && { video: props.video }),
            ...(props.virtualBackgroundUrl != null && { virtualBackgroundUrl: props.virtualBackgroundUrl }),
        }).forEach(([k, v]) => {
            if (!roomUrl.searchParams.has(k)) {
                roomUrl.searchParams.set(k, v);
            }
        });

        React.useImperativeHandle(ref, () => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return Object.assign(webviewRef.current!, {
                endMeeting: () => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("end_meeting", []));
                },
                knock: () => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("knock", []));
                },
                leaveRoom: () => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("leave_room", []));
                },
                openSettings: (settingsPane: SettingsPane = "media") => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("open_settings", [settingsPane]));
                },
                startRecording: () => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("start_recording", []));
                },
                stopRecording: () => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("stop_recording", []));
                },
                startStreaming: () => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("start_streaming", []));
                },
                stopStreaming: () => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("stop_streaming", []));
                },
                startLiveTranscription: () => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("start_live_transcription", []));
                },
                stopLiveTranscription: () => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("stop_live_transcription", []));
                },
                toggleBreakout: (enabled?: boolean) => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("toggle_breakout", [enabled]));
                },
                toggleCamera: (enabled?: boolean) => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("toggle_camera", [enabled]));
                },
                toggleMicrophone: (enabled?: boolean) => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("toggle_microphone", [enabled]));
                },
                togglePeople: (enabled?: boolean) => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("toggle_people", [enabled]));
                },
                toggleScreenshare: (enabled?: boolean) => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("toggle_screenshare", [enabled]));
                },
                toggleChat: (enabled?: boolean) => {
                    webviewRef.current?.injectJavaScript(getInjectableJSMessage("toggle_chat", [enabled]));
                },
            });
        });

        const handleMessage = React.useCallback(
            (event: WebViewMessageEvent) => {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type && WHEREBY_EVENT_TYPES.includes(data.type)) {
                    props.onWherebyMessage?.(data);

                    switch (data.type) {
                        case "ready":
                            props.onReady?.();
                            break;
                        case "knock":
                            props.onKnock?.();
                            break;
                        case "participantupdate":
                            props.onParticipantUpdate?.(data.payload);
                            break;
                        case "join":
                            props.onJoin?.();
                            break;
                        case "leave":
                            props.onLeave?.(data.payload);
                            break;
                        case "participant_join":
                            props.onParticipantJoin?.(data.payload);
                            break;
                        case "participant_leave":
                            props.onParticipantLeave?.(data.payload);
                            break;
                        case "meeting_end":
                            props.onMeetingEnd?.();
                            break;
                        case "microphone_toggle":
                            props.onMicrophoneToggle?.(data.payload);
                            break;
                        case "camera_toggle":
                            props.onCameraToggle?.(data.payload);
                            break;
                        case "chat_toggle":
                            props.onChatToggle?.(data.payload);
                            break;
                        case "people_toggle":
                            props.onPeopleToggle?.(data.payload);
                            break;
                        case "pip_toggle":
                            props.onPipToggle?.(data.payload);
                            break;
                        case "grant_device_permission":
                            props.onGrantDevicePermission?.(data.payload);
                            break;
                        case "deny_device_permission":
                            props.onDenyDevicePermission?.(data.payload);
                            break;
                        case "screenshare_toggle":
                            props.onScreenshareToggle?.(data.payload);
                            break;
                        case "streaming_status_change":
                            props.onStreamingStatusChange?.(data.payload);
                            break;
                        case "connection_status_change":
                            props.onConnectionStatusChange?.(data.payload);
                            break;
                        case "precall_check_skipped":
                            props.onPrecallCheckSkipped?.();
                            break;
                        case "precall_check_completed":
                            props.onPrecallCheckCompleted?.(data.payload);
                            break;
                        default:
                            break;
                    }
                }
                props.onMessage?.(event);
            },
            [props],
        );

        return (
            <WebView
                ref={webviewRef}
                source={{ uri: roomUrl.href }}
                startInLoadingState
                originWhitelist={["*"]}
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback
                javaScriptEnabled
                domStorageEnabled
                {...props}
                onMessage={handleMessage}
            />
        );
    },
);

export { WherebyEmbed, type WherebyWebView };
