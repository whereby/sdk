import { define, ref } from "heresy";
import { ReactHTMLElement } from "react";

import { parseRoomUrlAndSubdomain } from "@whereby.com/core";

interface WherebyEmbedElementAttributes extends ReactHTMLElement<HTMLElement> {
    aec: string;
    agc: string;
    audio: string;
    /**
     * Automatically spotlight the local participant on room join. Can only be used with users joining with host privileges.
     */
    audioDenoiser: string;
    autoHideSelfView: string;
    autoSpotlight: string;
    avatarUrl: string;
    background: string;
    bottomToolbar: string;
    breakout: string;
    cameraAccess: string;
    chat: string;
    displayName: string;
    emptyRoomInvitation: string;
    externalId: string;
    floatSelf: string;
    groups: string;
    help: string;
    lang: string;
    leaveButton: string;
    locking: string;
    logo: string;
    lowData: string;
    metadata: string;
    minimal: string;
    moreButton: string;
    participantCount: string;
    people: string;
    pipButton: string;
    /**
     * Displays a device and connectivity test for the user. Is dependent on precallReview being enabled
     */
    precallCeremony: string;
    precallReview: string;
    precallPermissionsHelpLink: string;
    precallCeremonyCanSkip: string;
    recording: string;
    room: string;
    /**
     * Enables the use of supported room integrations (Miro and YouTube)
     */
    roomIntegrations: string;
    settingsButton: string;
    screenshare: string;
    /**
     * Skips the Whereby permissions UI and causes browser to automatically request device permissions. Required for Android app integrations.
     */
    skipMediaPermissionPrompt: string;
    style: { [key: string]: string };
    subgridLabels: string;
    timer: string;
    title: string;
    video: string;
    virtualBackgroundUrl: string;
}

interface WherebyEmbedElementEventMap {
    ready: CustomEvent;
    knock: CustomEvent;
    participantupdate: CustomEvent<{ count: number }>;
    join: CustomEvent;
    leave: CustomEvent<{ removed: boolean }>;
    participant_join: CustomEvent<{ participant: { metadata: string } }>;
    participant_leave: CustomEvent<{ participant: { metadata: string } }>;
    microphone_toggle: CustomEvent<{ enabled: boolean }>;
    camera_toggle: CustomEvent<{ enabled: boolean }>;
    chat_toggle: CustomEvent<{ open: boolean }>;
    people_toggle: CustomEvent<{ open: boolean }>;
    pip_toggle: CustomEvent<{ open: boolean }>;
    deny_device_permission: CustomEvent<{ denied: boolean }>;
    screenshare_toggle: CustomEvent<{ enabled: boolean }>;
    streaming_status_change: CustomEvent<{ status: string }>;
    connection_status_change: CustomEvent<{ status: "stable" | "unstable" }>;
}

interface WherebyEmbedElementCommands {
    startRecording: () => void;
    stopRecording: () => void;
    startStreaming: () => void;
    stopStreaming: () => void;
    toggleCamera: (enabled?: boolean) => void;
    toggleMicrophone: (enabled?: boolean) => void;
    toggleScreenshare: (enabled?: boolean) => void;
    toogleChat: (enabled?: boolean) => void;
}

export interface WherebyEmbedElement extends HTMLIFrameElement, WherebyEmbedElementCommands {
    addEventListener<K extends keyof (WherebyEmbedElementEventMap & HTMLElementEventMap)>(
        type: K,
        listener: (this: HTMLIFrameElement, ev: (WherebyEmbedElementEventMap & HTMLElementEventMap)[K]) => void,
        options?: boolean | AddEventListenerOptions | undefined,
    ): void;
}

declare global {
    namespace JSX {
        interface IntrinsicElements {
            ["whereby-embed"]: Partial<WherebyEmbedElementAttributes>;
        }
    }
}

const boolAttrs = [
    "aec",
    "agc",
    "audio",
    "audioDenoiser",
    "autoHideSelfView",
    "autoSpotlight",
    "background",
    "bottomToolbar",
    "cameraAccess",
    "chat",
    "people",
    "embed",
    "emptyRoomInvitation",
    "help",
    "leaveButton",
    "precallCeremony",
    "precallReview",
    "screenshare",
    "video",
    "floatSelf",
    "recording",
    "logo",
    "locking",
    "precallCeremonyCanSkip",
    "participantCount",
    "precallPermissionsHelpLink",
    "settingsButton",
    "pipButton",
    "moreButton",
    "personality",
    "skipMediaPermissionPrompt",
    "subgridLabels",
    "lowData",
    "breakout",
    "roomIntegrations",
    "timer",
];

define("WherebyEmbed", {
    oninit() {
        this.iframe = ref();
    },
    onconnected() {
        window.addEventListener("message", this.onmessage.bind(this));
    },
    ondisconnected() {
        window.removeEventListener("message", this.onmessage.bind(this));
    },
    observedAttributes: [
        "displayName",
        "minimal",
        "room",
        "subdomain",
        "lang",
        "metadata",
        "groups",
        "virtualBackgroundUrl",
        "avatarUrl",
        "externalId",
        "title",
        ...boolAttrs,
    ].map((a) => a.toLowerCase()),
    onattributechanged({ attributeName, oldValue }) {
        if (["room", "subdomain"].includes(attributeName) && oldValue == null) return;
        this.render();
    },
    style(self: string) {
        return `
    ${self} {
      display: block;
    }
    ${self} iframe {
      border: none;
      height: 100%;
      width: 100%;
    }
    `;
    },

    // Commands
    _postCommand(command: string, args = []) {
        if (this.iframe.current) {
            this.iframe.current.contentWindow.postMessage({ command, args }, this.roomUrl.origin);
        }
    },
    startRecording() {
        this._postCommand("start_recording");
    },
    stopRecording() {
        this._postCommand("stop_recording");
    },
    startStreaming() {
        this._postCommand("start_streaming");
    },
    stopStreaming() {
        this._postCommand("stop_streaming");
    },
    toggleCamera(enabled?: boolean) {
        this._postCommand("toggle_camera", [enabled]);
    },
    toggleMicrophone(enabled?: boolean) {
        this._postCommand("toggle_microphone", [enabled]);
    },
    toggleScreenshare(enabled?: boolean) {
        this._postCommand("toggle_screenshare", [enabled]);
    },
    toggleChat(enabled?: boolean) {
        this._postCommand("toggle_chat", [enabled]);
    },

    onmessage<E extends keyof WherebyEmbedElementEventMap>({
        origin,
        data,
    }: {
        origin: string;
        data: { type: E; payload: WherebyEmbedElementEventMap[E] };
    }) {
        if (!this.roomUrl || origin !== this.roomUrl.origin) return;
        const { type, payload: detail } = data;

        this.dispatchEvent(new CustomEvent(type, { detail }));
    },

    render() {
        const {
            avatarurl: avatarUrl,
            displayname: displayName,
            lang,
            metadata,
            externalid: externalId,
            minimal,
            room,
            groups,
            virtualbackgroundurl: virtualBackgroundUrl,
            title,
        } = this;
        let roomUrl, subdomain;

        try {
            ({ roomUrl, subdomain } = parseRoomUrlAndSubdomain(room, this.subdomain));
        } catch (error) {
            return this.html`Whereby: ${error instanceof Error ? error.message : "unknown error"}`;
        }

        this.roomUrl = roomUrl;

        Object.entries({
            jsApi: true,
            we: "1",
            iframeSource: subdomain,
            ...(displayName && { displayName }),
            ...(lang && { lang: lang }),
            ...(metadata && { metadata: metadata }),
            ...(externalId && { externalId }),
            ...(groups && { groups: groups }),
            ...(virtualBackgroundUrl && { virtualBackgroundUrl: virtualBackgroundUrl }),
            ...(avatarUrl && { avatarUrl: avatarUrl }),
            // the original ?embed name was confusing, so we give minimal
            ...(minimal != null && { embed: minimal }),
            ...boolAttrs.reduce(
                // add to URL if set in any way
                (o, v) => (this[v.toLowerCase()] != null ? { ...o, [v]: this[v.toLowerCase()] } : o),
                {},
            ),
        }).forEach(([k, v]) => {
            if (!this.roomUrl.searchParams.has(k)) {
                this.roomUrl.searchParams.set(k, v);
            }
        });
        this.html`
      <iframe
        title=${title || "Video calling component"}
        ref=${this.iframe}
        src=${this.roomUrl}
        allow="autoplay; camera; microphone; fullscreen; speaker; display-capture; media-capture" />
      `;
    },
});

export default { sdkVersion: "1" };
