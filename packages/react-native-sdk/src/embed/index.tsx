import * as React from "react";
import { WebView, WebViewMessageEvent, WebViewProps } from "react-native-webview";

type SettingsPane = "theme" | "integrations" | "streaming" | "effects" | "notifications" | "advanced" | "media" | null;

function getInjectableJSMessage(command: string, args: unknown[]) {
    const parsedArgs = args.length === 1 && args[0] === undefined ? "" : `, args: ${JSON.stringify(args)}`;
    return `(function() { window.postMessage({ command: ${JSON.stringify(command)}${parsedArgs} }) })()`;
}

interface WherebyEmbedElementAttributes {
    aec?: boolean;
    agc?: boolean;
    audio?: boolean;
    /**
     * Automatically spotlight the local participant on room join. Can only be used with users joining with host privileges.
     */
    audioDenoiser?: boolean;
    autoHideSelfView?: boolean;
    autoSpotlight?: boolean;
    avatarUrl?: string;
    background?: boolean;
    bottomToolbar?: boolean;
    breakout?: boolean;
    callQualityMonitoring?: boolean;
    cameraAccess?: boolean;
    cameraEffect?:
        | "slight-blur"
        | "blur"
        | "image-cabin"
        | "image-concrete"
        | "image-brick"
        | "image-sunrise"
        | "image-day"
        | "image-night";
    chat?: boolean;
    displayName?: string;
    emptyRoomInvitation?: boolean;
    emojiSkinTone?: string;
    externalId?: string;
    floatSelf?: boolean;
    groups?: string;
    help?: boolean;
    lang?: "fr" | "it" | "de" | "nb" | "da" | "nl" | "pt" | "pl" | "es" | "hi" | "cs" | "zh-hant" | "jp";
    leaveButton?: boolean;
    locking?: boolean;
    localization?: boolean;
    logo?: boolean;
    lowData?: boolean;
    metadata?: string;
    minimal?: boolean;
    moreButton?: boolean;
    participantCount?: boolean;
    people?: boolean;
    pipButton?: boolean;
    /**
     * Displays a device and connectivity test for the user. Is dependent on precallReview being enabled
     */
    precallCeremony?: boolean;
    precallReview?: boolean;
    precallPermissionsHelpLink?: string;
    precallCeremonyCanSkip?: boolean;
    reactions?: boolean;
    recording?: boolean;
    /**
     * Enables the use of supported room integrations (Miro and YouTube)
     */
    roomIntegrations?: boolean;
    settingsButton?: boolean;
    screenshare?: boolean;
    /**
     * Skips the Whereby permissions UI and causes browser to automatically request device permissions. Required for Android app integrations.
     */
    skipMediaPermissionPrompt?: boolean;
    subgridLabels?: boolean;
    timer?: boolean;
    title?: string;
    /**
     * Use dark text for bottom toolbar items.
     *
     * Use this attribute when the room background is light and the bottom toolbar items are hard to read.
     */
    toolbarDarkText?: boolean;
    topToolbar?: boolean;
    video?: boolean;
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
            ...(props.minimal != null && { embed: props.minimal ? "on" : "off" }),
            ...(props.aec != null && { aec: props.aec ? "on" : "off" }),
            ...(props.agc != null && { agc: props.agc ? "on" : "off" }),
            ...(props.audio != null && { audio: props.audio ? "on" : "off" }),
            ...(props.audioDenoiser != null && { audioDenoiser: props.audioDenoiser ? "on" : "off" }),
            ...(props.autoHideSelfView != null && { autoHideSelfView: props.autoHideSelfView ? "on" : "off" }),
            ...(props.autoSpotlight != null && { autoSpotlight: props.autoSpotlight ? "on" : "off" }),
            ...(props.background != null && { background: props.background ? "on" : "off" }),
            ...(props.bottomToolbar != null && { bottomToolbar: props.bottomToolbar ? "on" : "off" }),
            ...(props.breakout != null && { breakout: props.breakout ? "on" : "off" }),
            ...(props.callQualityMonitoring != null && {
                callQualityMonitoring: props.callQualityMonitoring ? "on" : "off",
            }),
            ...(props.cameraAccess != null && { cameraAccess: props.cameraAccess ? "on" : "off" }),
            ...(props.cameraEffect != null && { cameraEffect: props.cameraEffect }),
            ...(props.chat != null && { chat: props.chat ? "on" : "off" }),
            ...(props.displayName != null && { displayName: props.displayName }),
            ...(props.emptyRoomInvitation != null && { emptyRoomInvitation: props.emptyRoomInvitation ? "on" : "off" }),
            ...(props.emojiSkinTone != null && { emojiSkinTone: props.emojiSkinTone }),
            ...(props.externalId != null && { externalId: props.externalId }),
            ...(props.floatSelf != null && { floatSelf: props.floatSelf ? "on" : "off" }),
            ...(props.groups != null && { groups: props.groups }),
            ...(props.help != null && { help: props.help ? "on" : "off" }),
            ...(props.lang != null && { lang: props.lang }),
            ...(props.leaveButton != null && { leaveButton: props.leaveButton ? "on" : "off" }),
            ...(props.locking != null && { locking: props.locking ? "on" : "off" }),
            ...(props.localization != null && { localization: props.localization ? "on" : "off" }),
            ...(props.logo != null && { logo: props.logo ? "on" : "off" }),
            ...(props.lowData != null && { lowData: props.lowData ? "on" : "off" }),
            ...(props.moreButton != null && { moreButton: props.moreButton ? "on" : "off" }),
            ...(props.participantCount != null && { participantCount: props.participantCount ? "on" : "off" }),
            ...(props.people != null && { people: props.people ? "on" : "off" }),
            ...(props.pipButton != null && { pipButton: props.pipButton ? "on" : "off" }),
            ...(props.precallCeremony != null && { precallCeremony: props.precallCeremony ? "on" : "off" }),
            ...(props.precallReview != null && { precallReview: props.precallReview ? "on" : "off" }),
            ...(props.precallPermissionsHelpLink != null && {
                precallPermissionsHelpLink: props.precallPermissionsHelpLink,
            }),
            ...(props.precallCeremonyCanSkip != null && {
                precallCeremonyCanSkip: props.precallCeremonyCanSkip ? "on" : "off",
            }),
            ...(props.reactions != null && { reactions: props.reactions ? "on" : "off" }),
            ...(props.recording != null && { recording: props.recording ? "on" : "off" }),
            ...(props.roomIntegrations != null && { roomIntegrations: props.roomIntegrations ? "on" : "off" }),
            ...(props.settingsButton != null && { settingsButton: props.settingsButton ? "on" : "off" }),
            ...(props.screenshare != null && { screenshare: props.screenshare ? "on" : "off" }),
            ...(props.skipMediaPermissionPrompt != null && {
                skipMediaPermissionPrompt: props.skipMediaPermissionPrompt ? "on" : "off",
            }),
            ...(props.subgridLabels != null && { subgridLabels: props.subgridLabels ? "on" : "off" }),
            ...(props.timer != null && { timer: props.timer ? "on" : "off" }),
            ...(props.title != null && { title: props.title }),
            ...(props.toolbarDarkText != null && { toolbarDarkText: props.toolbarDarkText ? "on" : "off" }),
            ...(props.topToolbar != null && { topToolbar: props.topToolbar ? "on" : "off" }),
            ...(props.video != null && { video: props.video ? "on" : "off" }),
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
