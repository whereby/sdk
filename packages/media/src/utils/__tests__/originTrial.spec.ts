import { registerOriginTrials } from "../originTrial";

describe("registerOriginTrials", () => {
    let document: any;
    let token: string;

    beforeEach(() => {
        document = {
            createElement: jest.fn(() => ({
                httpEquiv: "",
                content: "",
            })),
            head: {
                append: jest.fn(),
            },
            location: {
                hostname: "hostname.com",
            },
        };

        token = "token";
    });

    it("should append meta tags for origin trials when location matches", () => {
        registerOriginTrials(
            [
                {
                    hostnamePattern: /hostname\.com/,
                    token,
                },
            ],
            {},
            document as any,
        );

        expect(document.createElement).toHaveBeenCalledWith("meta");
        expect(document.head.append).toHaveBeenCalledWith({ httpEquiv: "origin-trial", content: token });
    });

    it("should not append meta tags for origin trials when location does not match", () => {
        registerOriginTrials(
            [
                {
                    hostnamePattern: /host-name\.com/,
                    token,
                },
            ],
            {},
            document as any,
        );

        expect(document.createElement).not.toHaveBeenCalledWith("meta");
        expect(document.head.append).not.toHaveBeenCalledWith({ httpEquiv: "origin-trial", content: token });
    });

    it("should not append meta tags for origin trials if already registered", () => {
        registerOriginTrials(
            [
                {
                    hostnamePattern: /hostname\.com/,
                    token,
                },
            ],
            { [`${/hostname\.com/}-${token}`]: true },
            document as any,
        );

        expect(document.createElement).not.toHaveBeenCalledWith("meta");
        expect(document.head.append).not.toHaveBeenCalledWith({ httpEquiv: "origin-trial", content: token });
    });

    describe("when multiple origin trials are provided", () => {
        it("should append meta tags for all origin trials when location matches unless already registered", () => {
            registerOriginTrials(
                [
                    {
                        hostnamePattern: /hostname\.com/,
                        token: "token1",
                    },
                    {
                        hostnamePattern: /hostname\.com/,
                        token: "token2",
                    },
                    {
                        hostnamePattern: /hostname\.com/,
                        token: "token3",
                    },
                    {
                        hostnamePattern: /host-name\.com/,
                        token: "token4",
                    },
                ],
                { [`${/hostname\.com/}-token1`]: true },
                document as any,
            );

            expect(document.createElement).toHaveBeenCalledTimes(2);
            expect(document.head.append).toHaveBeenCalledTimes(2);
        });
    });
});
