import * as React from "react";

import { Avatar, AvatarWrapper, AvatarImage } from "../index";
import { CSSObject } from "@emotion/react";

const randomAvatar = "https://api.dicebear.com/8.x/adventurer/svg?backgroundColor=b6e3f4,c0aede,d1d4f9";

const names = [
    "Atle Antonsen",
    "Anonyme Alkoholikere",
    "Hans Majestet Kongen",
    "Bjørn Skog",
    "Kjell T. Ring",
    "Håvard Holvik",
    "Hans Hansen Hover Han Der",
    "Aans Bansen Cover Dan Eer",
    "Madonna",
    "Munin",
    "Eva",
    "Paul",
    "Per Ulv",
    "Herman Hatt",
    "으니🌸",
    "?!=12==||( )",
    "👩‍👧‍👧 🌸",
    "📍NYC",
    "🌳 Tree",
    "",
];

export default {
    title: "Avatar",
};

export const Default = {
    render: ({ size, withAvatarUrlSet, name }: { size: number; withAvatarUrlSet: boolean; name?: string }) => (
        <Avatar size={size} avatarUrl={withAvatarUrlSet ? randomAvatar : undefined} name={name} />
    ),
    argTypes: {
        size: { control: "range", min: 0, max: 200 },
        withAvatarUrlSet: { control: "boolean" },
        name: { control: "text" },
    },
    args: { size: 40, withAvatarUrlSet: false, name: names[0] },
};

export const WithAvatarUrlSet = () => <Avatar avatarUrl={randomAvatar} name={"John Doe"} />;
WithAvatarUrlSet.storyName = "with avatarUrl set";

export const WithAvatarNameSet = () => <Avatar name={"John Doe"} />;
WithAvatarNameSet.storyName = "with name set";

export const WhenSizeIs60 = () => <Avatar avatarUrl={randomAvatar} size={60} name={"John Doe"} />;
WhenSizeIs60.storyName = "when size is 60";

export const WhenSizeIs200 = () => <Avatar avatarUrl={randomAvatar} size={200} name={"John Doe"} />;
WhenSizeIs200.storyName = "when size is 200";

export const WithCustomStyling = {
    render: ({ name, withAvatarUrlSet }: { name?: string; withAvatarUrlSet: boolean }) => {
        const customCss = `
            .avatarWrapper {
                width: 150px;
                height: 150px;
                border-radius: 50% 25%
            }
            .avatarImage {
                fill: red;
                background-color: blue;
            }
        `;
        return (
            <>
                <style>{customCss}</style>
                <AvatarWrapper name={name} className={"avatarWrapper"}>
                    <AvatarImage
                        avatarUrl={withAvatarUrlSet ? randomAvatar : undefined}
                        name={name}
                        className={"avatarImage"}
                    />
                </AvatarWrapper>
            </>
        );
    },
    name: "with custom styling",
    argTypes: {
        withAvatarUrlSet: { control: "boolean" },
        name: { control: "text" },
    },
    args: {
        withAvatarUrlSet: false,
        name: names[0],
    },
};

export const WithNameSet = () => (
    <>
        {([32, 36, 40, 60, 80] as const).map((size) =>
            names.map((name) => (
                <div key={size + name} style={{ display: "inline-block", margin: 4 }}>
                    <Avatar name={name} size={size} />
                </div>
            )),
        )}
    </>
);
WithNameSet.storyName = "with name set";
