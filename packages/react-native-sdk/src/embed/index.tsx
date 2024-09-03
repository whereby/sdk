import * as React from "react";
import { WebView, WebViewProps } from "react-native-webview";

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

interface WherebyEmbedProps extends WebViewProps, WherebyEmbedElementAttributes {
    room: string;
}

const WherebyEmbed = React.forwardRef<React.ElementRef<typeof WebView>, WherebyEmbedProps>(
    ({ room, ...props }: WherebyEmbedProps, ref) => {
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

        return (
            <WebView
                ref={ref}
                source={{ uri: roomUrl.href }}
                startInLoadingState
                originWhitelist={["*"]}
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback
                javaScriptEnabled
                domStorageEnabled
                {...props}
            />
        );
    },
);

type WherebyEmbedRef = React.ElementRef<typeof WebView>;

export { WherebyEmbed, type WherebyEmbedRef };
