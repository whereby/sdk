import { jest } from "@jest/globals";

const define = jest.fn();
const ref = jest.fn();

jest.mock("heresy", () => ({
    __esModule: true,
    define,
    ref,
}));

describe("@whereby/browser-sdk", () => {
    describe("web component", () => {
        it("should define <whereby-embed />", async () => {
            await import("../");
            expect(define).toHaveBeenCalledWith("WherebyEmbed", expect.any(Object));
        });

        it("should expose attributes", async () => {
            await import("../");
            expect(define).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    observedAttributes: expect.arrayContaining([
                        "aec",
                        "agc",
                        "audio",
                        "audiodenoiser",
                        "autohideselfview",
                        "autospotlight",
                        "avatarurl",
                        "background",
                        "bottomtoolbar",
                        "breakout",
                        "callqualitymonitoring",
                        "cameraaccess",
                        "cameraeffect",
                        "chat",
                        "displayname",
                        "embed",
                        "emojiskintone",
                        "emptyroominvitation",
                        "externalid",
                        "floatself",
                        "groups",
                        "help",
                        "hidelegend",
                        "lang",
                        "leavebutton",
                        "localization",
                        "locking",
                        "logo",
                        "lowdata",
                        "metadata",
                        "minimal",
                        "morebutton",
                        "participantcount",
                        "people",
                        "personality",
                        "pipbutton",
                        "precallceremony",
                        "precallceremonycanskip",
                        "precallpermissionshelplink",
                        "precallreview",
                        "reactions",
                        "recording",
                        "room",
                        "roomintegrations",
                        "screenshare",
                        "settingsbutton",
                        "skipmediapermissionprompt",
                        "subdomain",
                        "subgridlabels",
                        "timer",
                        "title",
                        "toolbardarktext",
                        "toptoolbar",
                        "video",
                        "virtualbackgroundurl",
                    ]),
                }),
            );
        });

        it("should expose commands", async () => {
            await import("../");

            expect(define).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    startRecording: expect.any(Function),
                    stopRecording: expect.any(Function),
                    toggleCamera: expect.any(Function),
                    toggleMicrophone: expect.any(Function),
                    toggleScreenshare: expect.any(Function),
                    toggleChat: expect.any(Function),
                }),
            );
        });
    });
});
