import * as React from "react";

import { css } from "@emotion/react";
import { StoryFn } from "@storybook/react";

import * as Icons from "..";
import { IconProps } from "../base-icon";

const iconCellStyles = css({
    alignItems: "center",
    background: "#f4f4f4",
    borderRadius: "4px",
    display: "flex",
    flexFlow: "row nowrap",
    height: "60px",
    justifyContent: "center",
    margin: "4px",
    width: "60px",
});

function IconCell({ children, title, ...rest }: React.HtmlHTMLAttributes<HTMLDivElement>) {
    return (
        <div css={iconCellStyles} title={title} {...rest}>
            {children}
        </div>
    );
}

const iconGridStyles = css({
    display: "flex",
    flexFlow: "row wrap",
    margin: "16px",
    maxWidth: "500px",
});

const icons = Object.entries(Icons)
    .map(([name, Component]) => ({
        name,
        component: Component,
    }))
    .sort((a, b) => {
        if (a.name < b.name) {
            return -1;
        }
        if (a.name > b.name) {
            return 1;
        }
        return 0;
    });

function IconGrid({ variant, size, light }: IconProps & { light?: boolean }) {
    return (
        <div css={[iconGridStyles]}>
            {icons.map(({ name, component: Component }) => (
                <IconCell
                    key={name}
                    title={name}
                    style={
                        light
                            ? {
                                  backgroundColor: "#002d25",
                              }
                            : undefined
                    }
                >
                    <Component variant={variant} size={size} />
                </IconCell>
            ))}
        </div>
    );
}

export default {
    title: "Icons",
    decorators: [
        (Story: StoryFn) => (
            <span style={{ color: "purple" }}>
                <Story />
            </span>
        ),
    ],
};

export const Default = () => <IconGrid />;

export const Dark24Px = () => <IconGrid variant={"dark"} />;
Dark24Px.storyName = "Dark - 24px";

export const Dark16Px = () => <IconGrid variant={"dark"} size={"small"} />;
Dark16Px.storyName = "Dark - 16px";

export const DarkGrey24Px = () => <IconGrid variant={"darkGrey"} />;
Dark24Px.storyName = "Dark - 24px";

export const Grey24Px = () => <IconGrid variant={"grey"} />;
Dark24Px.storyName = "Dark - 24px";

export const MidGrey24Px = () => <IconGrid variant={"midGrey"} />;
Dark24Px.storyName = "Dark - 24px";

export const Light24Px = () => <IconGrid variant={"light"} light />;
Light24Px.storyName = "Light - 24px";

export const LightBlue24Px = () => <IconGrid variant={"lightBlue"} />;
Light24Px.storyName = "Light - 24px";

export const LightGreen24Px = () => <IconGrid variant={"lightGreen"} />;
Light24Px.storyName = "Light - 24px";

export const Primary24Px = () => <IconGrid variant={"primary"} />;
Primary24Px.storyName = "Primary - 24px";

export const Secondary24Px = () => <IconGrid variant={"secondary"} />;
Secondary24Px.storyName = "Secondary - 24px";

export const Negative24Px = () => <IconGrid variant={"negative"} />;
Negative24Px.storyName = "Negative - 24px";

export const MeetingRed24Px = () => <IconGrid variant={"meetingRed"} light />;
MeetingRed24Px.storyName = "Meeting Red - 24px";
