import { miro, roomIntegrationContent, roomIntegrationContentTagName, youtube } from "../roomIntegrationContent";

const VIDEO_ID = "dQw4w9WgXcQ";

describe("roomIntegrationContentTagName", () => {
    it("derives the tag the way each Bootstrap does", () => {
        expect(roomIntegrationContentTagName("youtube")).toEqual("youtube-integration-contentframe");
        expect(roomIntegrationContentTagName("miro")).toEqual("miro-integration-contentframe");
    });
});

describe("youtube", () => {
    it("produces the same prop set the integration's own bootstrap submits", () => {
        const content = youtube({ url: `https://www.youtube.com/watch?v=${VIDEO_ID}` })!;

        expect(content.tagName).toEqual("youtube-integration-contentframe");
        expect(content.shareUrl).toEqual(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
        expect(Object.keys(content.props).sort()).toEqual(
            [
                "aspectratio",
                "islive",
                "metadata",
                "paused",
                "playerstate",
                "seek",
                "started",
                "time",
                "videoref",
            ].sort(),
        );
        expect(content.props).toMatchObject({
            videoref: VIDEO_ID,
            time: 0,
            seek: 0,
            playerstate: "playing",
            paused: false,
        });
    });

    it.each([
        [`https://www.youtube.com/watch?v=${VIDEO_ID}`, "watch url"],
        [`https://youtu.be/${VIDEO_ID}`, "short url"],
        [`https://www.youtube.com/embed/${VIDEO_ID}`, "embed url"],
        [`https://www.youtube.com/shorts/${VIDEO_ID}`, "shorts url"],
        [`https://www.youtube.com/live/${VIDEO_ID}`, "live url"],
        [`https://www.youtube-nocookie.com/embed/${VIDEO_ID}`, "nocookie url"],
        [`https://www.youtube.com/watch?list=abc&v=${VIDEO_ID}`, "url with a preceding param"],
        [VIDEO_ID, "bare id"],
    ])("extracts the id from a %s (%s)", (input) => {
        expect(youtube({ url: input })?.props.videoref).toEqual(VIDEO_ID);
    });

    it("reads a start time out of the url", () => {
        const content = youtube({ url: `https://youtu.be/${VIDEO_ID}?t=90s` })!;

        expect(content.props.time).toEqual(90);
        expect(content.props.seek).toEqual(90);
        expect(content.shareUrl).toContain("&t=90s");
    });

    it("prefers an explicit startAt over the url", () => {
        const content = youtube({ url: `https://youtu.be/${VIDEO_ID}?t=90s`, startAt: 5 })!;
        expect(content.props.time).toEqual(5);
    });

    it("assumes a non-live 16:9 video when metadata is not supplied", () => {
        const content = youtube({ url: VIDEO_ID })!;

        expect(content.props.aspectratio).toEqual(16 / 9);
        expect(content.props.islive).toEqual(false);
    });

    it("uses supplied metadata, and mirrors it into the json blob the integration stores", () => {
        const content = youtube({
            url: VIDEO_ID,
            metadata: { aspectRatio: 4 / 3, isLive: true, title: "Live stream" },
        })!;

        expect(content.props.aspectratio).toEqual(4 / 3);
        expect(content.props.islive).toEqual(true);
        expect(JSON.parse(String(content.props.metadata))).toEqual({
            id: VIDEO_ID,
            aspectratio: 4 / 3,
            live: true,
            title: "Live stream",
        });
    });

    it("stamps a playback start just ahead of now, to cover the player's load time", () => {
        const before = Date.now();
        const started = Number(youtube({ url: VIDEO_ID })!.props.started);

        expect(started).toBeGreaterThan(before);
    });

    it("returns null for anything that is not a YouTube reference", () => {
        expect(youtube({ url: "https://vimeo.com/12345" })).toBeNull();
        expect(youtube({ url: "not a url" })).toBeNull();
        expect(youtube({ url: "" })).toBeNull();
        expect(youtube({ url: "abc" })).toBeNull();
    });

    it("only emits primitives, since props become HTML attributes", () => {
        const content = youtube({ url: VIDEO_ID })!;

        Object.values(content.props).forEach((value) => {
            expect(["string", "number", "boolean"]).toContain(typeof value);
        });
    });
});

describe("miro", () => {
    const accessLink = "https://miro.com/app/live-embed/uXjVKT3Ia64=/?moveToViewport=-1157,-1078,3062,2319";

    it("produces the same prop set the integration's own bootstrap submits", () => {
        const content = miro({ accessLink })!;

        expect(content).toEqual({
            tagName: "miro-integration-contentframe",
            shareUrl: accessLink,
            props: { accesslink: accessLink },
        });
    });

    it("accepts an access-link, which is what the board picker mints", () => {
        const link = "https://miro.com/app/access-link/mockId?boardAccessToken=mockToken";
        expect(miro({ accessLink: link })?.props.accesslink).toEqual(link);
    });

    it("rejects an ordinary board url, which the integration cannot render", () => {
        expect(miro({ accessLink: "https://miro.com/app/board/uXjVKT3Ia64=/" })).toBeNull();
    });

    it("returns null for anything that is not a Miro embed link", () => {
        expect(miro({ accessLink: "https://example.com" })).toBeNull();
        expect(miro({ accessLink: "" })).toBeNull();
    });
});

describe("roomIntegrationContent", () => {
    it("covers only the integrations that can render in the SDK", () => {
        expect(Object.keys(roomIntegrationContent).sort()).toEqual(["miro", "youtube"]);
    });
});
