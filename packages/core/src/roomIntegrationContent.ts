import { RoomIntegrationProps } from "@whereby.com/media";

export interface RoomIntegrationContent {
    tagName: string;
    shareUrl: string;
    props: RoomIntegrationProps;
}

export function roomIntegrationContentTagName(integrationName: string) {
    return `${integrationName}-integration-contentframe`;
}

const YOUTUBE_ID =
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/i;
const YOUTUBE_BARE_ID = /^[\w-]{11}$/;

function youtubeStartSeconds(url: string): number {
    const match = url.match(/[?&](?:t|start)=(\d+)s?/i);
    return match ? parseInt(match[1], 10) : 0;
}

export interface YouTubeContentMetadata {
    aspectRatio?: number;
    isLive?: boolean;
    title?: string;
}

export function youtube({
    url,
    startAt,
    metadata = {},
}: {
    url: string;
    startAt?: number;
    metadata?: YouTubeContentMetadata;
}): RoomIntegrationContent | null {
    const trimmed = (url || "").trim();
    const videoref = YOUTUBE_BARE_ID.test(trimmed) ? trimmed : trimmed.match(YOUTUBE_ID)?.[1];

    if (!videoref) {
        return null;
    }

    const time = startAt ?? youtubeStartSeconds(trimmed);
    const { aspectRatio = 16 / 9, isLive = false, title } = metadata;

    return {
        tagName: roomIntegrationContentTagName("youtube"),
        shareUrl: `https://www.youtube.com/watch?v=${videoref}${time ? `&t=${time}s` : ""}`,
        props: {
            videoref,
            time,
            seek: time,
            playerstate: "playing",
            // the element accounts for its own load time before it starts playing
            started: Date.now() + 4000,
            paused: false,
            aspectratio: aspectRatio,
            islive: isLive,
            // the integration stores this for its watch history and reads `aspectratio`/`live` back
            metadata: JSON.stringify({
                id: videoref,
                aspectratio: aspectRatio,
                live: isLive,
                ...(title ? { title } : {}),
            }),
        },
    };
}

/**
 * Miro accepts only the embed links its own API mints, a board url will not render.
 * `live-embed` is what "Embed" in Miro's share menu produces; `access-link` is what the board
 * picker returns, and carries a token granting access to boards that are not publicly shared.
 */
const MIRO_EMBED_LINK = /^https:\/\/miro\.com\/app\/(?:live-embed|access-link)\/[0-9a-zA-Z]+/i;

/**
 * Builds the content for a Miro share from an embed link.
 *
 * Miro cannot be built from an ordinary `miro.com/app/board/...` url: access links are minted by
 * Miro's board picker using Whereby's credentials. Use the hosted picker to let a user browse their
 * boards; use this when you already hold a link, e.g. one pasted from Miro's own Embed dialog.
 *
 * @returns null for anything that is not a Miro embed link.
 */
export function miro({ accessLink }: { accessLink: string }): RoomIntegrationContent | null {
    const trimmed = (accessLink || "").trim();

    if (!MIRO_EMBED_LINK.test(trimmed)) {
        return null;
    }

    return {
        tagName: roomIntegrationContentTagName("miro"),
        shareUrl: trimmed,
        props: { accesslink: trimmed },
    };
}

export const roomIntegrationContent = { youtube, miro };
