import { selectLocalMediaShouldStartWithOptions, selectLocalMediaShouldStop } from "../localMedia";

describe("localMediaSlice", () => {
    describe("reactors", () => {
        describe("reactLocalMediaStart", () => {
            it.each`
                appIsActive | localMediaStatus | localMediaOptions               | expected
                ${false}    | ${"inactive"}    | ${undefined}                    | ${undefined}
                ${false}    | ${"started"}     | ${undefined}                    | ${undefined}
                ${false}    | ${"started"}     | ${{ audio: true, video: true }} | ${undefined}
                ${true}     | ${"started"}     | ${{ audio: true, video: true }} | ${undefined}
                ${true}     | ${"inactive"}    | ${undefined}                    | ${undefined}
                ${true}     | ${"inactive"}    | ${{ audio: true, video: true }} | ${{ audio: true, video: true }}
            `(
                "expected $expected when appIsActive=$appIsActive, localMediaStatus=$localMediaStatus, localMediaOptions=$localMediaOptions",
                ({ appIsActive, localMediaStatus, localMediaOptions, expected }) => {
                    expect(
                        selectLocalMediaShouldStartWithOptions.resultFunc(
                            appIsActive,
                            localMediaStatus,
                            localMediaOptions,
                        ),
                    ).toEqual(expected);
                },
            );
        });

        describe("reactLocalMediaStop", () => {
            it.each`
                appIsActive | localMediaStatus | localMediaOptions               | expected
                ${true}     | ${"started"}     | ${undefined}                    | ${false}
                ${true}     | ${"started"}     | ${{ audio: true, video: true }} | ${false}
                ${false}    | ${"inactive"}    | ${{ audio: true, video: true }} | ${false}
                ${false}    | ${"started"}     | ${undefined}                    | ${false}
                ${false}    | ${"started"}     | ${{ audio: true, video: true }} | ${true}
            `(
                "expected $expected when appIsActive=$appIsActive, localMediaStatus=$localMediaStatus, localMediaOptions=$localMediaOptions",
                ({ appIsActive, localMediaStatus, localMediaOptions, expected }) => {
                    expect(
                        selectLocalMediaShouldStop.resultFunc(appIsActive, localMediaStatus, localMediaOptions),
                    ).toEqual(expected);
                },
            );
        });
    });
});
