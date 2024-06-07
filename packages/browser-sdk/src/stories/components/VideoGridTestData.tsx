import * as React from "react";
import { makeVideoCellView } from "../../lib/react/Grid/layout/cellView";
import { Avatar } from "@whereby.com/react-ui";
import { CellView } from "../../lib/react/Grid/layout/types";

export const NORMAL = 4 / 3;
export const WIDE = 16 / 9;
export const PORTRAIT = 3 / 4;
export const SQUARE = 1;

const NAMES = [
    "Shannon Winegar",
    "Renaldo Bettcher",
    "Rufus Swarey",
    "Melani Hockman",
    "Yu Finkle",
    "Sanjuanita Sauage",
    "Rod Vise",
    "Tandy Lile",
    "Willa Barto",
    "Randell Buttrey",
    "Beverlee Roepke",
    "Deeanna Mandeville",
    "Beau Junior",
    "Ramon Macon",
    "Tran Scholz",
    "Danyell Trotman",
    "Coretta Breaux",
    "Nakita Rudloff",
];

const sampleNameForIndex = (index: number) => NAMES[((index % NAMES.length) + NAMES.length) % NAMES.length];

function WebRtcVideo({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                alignItems: "center",
                height: "100%",
                width: "100%",
                backgroundColor: "#ffc0cb",
                color: "#000",
                display: "flex",
                fontSize: 30,
                justifyContent: "center",
                padding: "5px 10px",
                userSelect: "none",
            }}
        >
            {children}
        </div>
    );
}

function PresentationContent() {
    return (
        <div
            style={{
                background: "#222",
                width: "100%",
                height: "100%",
            }}
        />
    );
}

function SubgridClient({ index, cellPaddings }: { index: number; cellPaddings: { top: number; right: number } }) {
    const name = sampleNameForIndex(index);
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexFlow: "column nowrap",
                width: "100%",
                height: "100%",
                padding: `${cellPaddings.top}px ${cellPaddings.right}px`,
            }}
        >
            <Avatar name={name} variant={"square"} />
            <div
                style={{
                    width: "100%",
                    fontSize: "var(--font-size-small)",
                    lineHeight: "var(--font-line-height-small)",
                    textShadow: "var(--drop-shadow-small)",
                    color: "#000",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {name}
            </div>
        </div>
    );
}

export function renderCellView({ cellView, isPresentation }: { cellView: CellView; isPresentation?: boolean }) {
    const clientId = cellView.client?.id || "";

    switch (cellView.type) {
        case "video":
            return cellView.isSubgrid ? (
                <SubgridClient
                    key={cellView.clientId}
                    index={parseInt(clientId.split("-")[1])}
                    cellPaddings={cellView.cellPaddings || { top: 0, right: 0 }}
                />
            ) : isPresentation ? (
                <PresentationContent key={`presentation-${cellView.clientId}`} />
            ) : (
                <WebRtcVideo key={cellView.clientId}>{clientId.split("-")[1]}</WebRtcVideo>
            );
        default:
            throw new Error("Unhandled cellView type");
    }
}

const pickRatio = ({ ratios, index }: { ratios: number[]; index: number }) => ratios[index % ratios.length];

export function createVideoCellViews({
    count,
    ratios,
    isSubgrid = false,
}: {
    count: number;
    ratios: number[];
    isSubgrid?: boolean;
}) {
    const clients = [];
    for (let i = 0; i < count; i++) {
        clients.push(
            makeVideoCellView({
                aspectRatio: isSubgrid ? undefined : pickRatio({ ratios, index: i }),
                client: {
                    id: `${isSubgrid ? "subgrid" : "video"}-${i + 1}`,
                    displayName: sampleNameForIndex(i),
                    clientId: `${i + 1}`,
                },
                isSubgrid,
            }),
        );
    }
    return clients;
}
