import { selectLocalMediaShouldStartWithOptions, selectLocalMediaShouldStop } from "../localMedia";

describe("localMediaSlice", () => {
    describe("reactors", () => {
        describe("reactLocalMediaStart", () => {
            it.each`
                appIsActive | localMediaStatus | localMediaOptions               | isNodeSdk | expected
                ${false}    | ${"inactive"}    | ${undefined}                    | ${false}  | ${undefined}
                ${false}    | ${"started"}     | ${undefined}                    | ${false}  | ${undefined}
                ${false}    | ${"started"}     | ${{ audio: true, video: true }} | ${false}  | ${undefined}
                ${true}     | ${"started"}     | ${{ audio: true, video: true }} | ${false}  | ${undefined}
                ${true}     | ${"inactive"}    | ${undefined}                    | ${false}  | ${undefined}
                ${true}     | ${"inactive"}    | ${{ audio: true, video: true }} | ${true}   | ${undefined}
                ${true}     | ${"inactive"}    | ${{ audio: true, video: true }} | ${false}  | ${{ audio: true, video: true }}
            `(
                "expected $expected when appIsActive=$appIsActive, localMediaStatus=$localMediaStatus, localMediaOptions=$localMediaOptions, isNodeSdk=$isNodeSdk",
                ({ appIsActive, localMediaStatus, localMediaOptions, isNodeSdk, expected }) => {
                    expect(
                        selectLocalMediaShouldStartWithOptions.resultFunc(
                            appIsActive,
                            localMediaStatus,
                            localMediaOptions,
                            isNodeSdk,
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
