import * as React from "react";

import { ClientView, selectSpotlightedClientViews } from "@whereby.com/core";

import {
    ParticipantMenu,
    ParticipantMenuContent,
    ParticipantMenuItem,
    ParticipantMenuTrigger,
} from "../ParticipantMenu";
import { EllipsisIcon } from "../../../EllipsisIcon";
import { useAppSelector } from "../../Provider/hooks";
import { MaximizeOnIcon } from "../../../MaximizeOnIcon";
import { SpotlightIcon } from "../../../SpotlightIcon";
import { useGridCell } from "../GridContext";

interface DefaultParticipantMenuProps {
    participant: ClientView;
}

function DefaultParticipantMenu({ participant }: DefaultParticipantMenuProps) {
    const spotlightedParticipants = useAppSelector(selectSpotlightedClientViews);
    const isSpotlighted = spotlightedParticipants.find((p) => p.id === participant.id);
    const { isHovered, maximizedParticipant } = useGridCell();
    const isMaximized = maximizedParticipant?.id === participant.id;

    if (!isHovered) {
        return null;
    }

    return (
        <ParticipantMenu>
            <ParticipantMenuTrigger
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#fff",
                    borderRadius: "6px",
                    padding: "4px",
                }}
            >
                <EllipsisIcon height={20} width={20} transform={"rotate(90)"} />
            </ParticipantMenuTrigger>
            <ParticipantMenuContent>
                <ParticipantMenuItem
                    participantAction={"maximize"}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                    }}
                >
                    <MaximizeOnIcon height={16} width={16} />
                    {isMaximized ? "Minimize" : "Maximize"}
                </ParticipantMenuItem>
                <ParticipantMenuItem
                    participantAction={"spotlight"}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                    }}
                >
                    <SpotlightIcon height={16} width={16} />
                    {isSpotlighted ? "Remove spotlight" : "Spotlight"}
                </ParticipantMenuItem>
            </ParticipantMenuContent>
        </ParticipantMenu>
    );
}

export { DefaultParticipantMenu };
