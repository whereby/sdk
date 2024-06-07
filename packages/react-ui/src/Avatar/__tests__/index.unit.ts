import { getInitialsFromName } from "..";

describe("Avatar", () => {
    describe("getInitialsFromName", () => {
        it.each`
            name                     | expected
            ${"Per Ulv"}             | ${["P", "U"]}
            ${"Fi-Un Cin Kake X Ja"} | ${["F", "U", "C"]}
            ${"odin Yo"}             | ${["o", "Y"]}
            ${"wAT"}                 | ${["w"]}
            ${"?hah ja?"}            | ${["?", "j"]}
            ${"?"}                   | ${["?"]}
            ${" "}                   | ${[]}
            ${"으니🌸"}              | ${["으"]}
            ${"으니 🌸"}             | ${["으", "🌸"]}
        `("should return $expected for $name", ({ name, expected }) => {
            expect(getInitialsFromName(name)).toEqual(expected);
        });
    });
});
