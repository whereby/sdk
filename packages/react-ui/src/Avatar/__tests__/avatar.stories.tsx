import * as React from "react";

import { Avatar } from "../index";

const randomAvatar = "https://avatar.iran.liara.run/public";

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

export const Default = () => <Avatar />;

export const WithAvatarUrlSet = () => <Avatar avatarUrl={randomAvatar} name={"John Doe"} />;
WithAvatarUrlSet.storyName = "with avatarUrl set";

export const WithAvatarUrlSetSquare = () => <Avatar avatarUrl={randomAvatar} name={"John Doe"} variant={"square"} />;
WithAvatarUrlSetSquare.storyName = "with avatarUrl set - square";

export const WithAvatarNameSetSquare = () => <Avatar variant={"square"} name={"John Doe"} />;
WithAvatarNameSetSquare.storyName = "with name set - square";

export const WithNameSetRound = () => <Avatar variant={"round"} name={"John Doe"} />;
WithNameSetRound.storyName = "with name set - round";

export const WithNameSetOutline = () => <Avatar variant={"outline"} name={"John Doe"} />;
WithNameSetOutline.storyName = "with name set - outline";

export const WhenSizeIs60 = () => <Avatar avatarUrl={randomAvatar} size={60} name={"John Doe"} />;
WhenSizeIs60.storyName = "when size is 60";

export const WhenSizeIs200 = () => <Avatar avatarUrl={randomAvatar} size={200} name={"John Doe"} />;
WhenSizeIs200.storyName = "when size is 200";

export const WithNameSet = () => (
    <>
        {([32, 36, 40, 60, 80] as const).map((size) =>
            names.map((name) => (
                <div key={size + name} style={{ display: "inline-block", margin: 4 }}>
                    <Avatar name={name} size={size} variant={"square"} />
                </div>
            )),
        )}
    </>
);
WithNameSet.storyName = "with name set";
