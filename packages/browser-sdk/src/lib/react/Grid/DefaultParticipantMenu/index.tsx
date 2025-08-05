import * as React from "react";

import { ClientView } from "@whereby.com/core";

import {
    ParticipantMenu,
    ParticipantMenuContent,
    ParticipantMenuItem,
    ParticipantMenuTrigger,
} from "../ParticipantMenu";
import { EllipsisIcon } from "../../../EllipsisIcon";
import { MaximizeOnIcon } from "../../../MaximizeOnIcon";
import { SpotlightIcon } from "../../../SpotlightIcon";
import { useGridCell } from "../GridContext";
import { PopOutIcon } from "../../../PopOutIcon";
import { PopInIcon } from "../../../PopInIcon";
import { useGridParticipants } from "../useGridParticipants";

interface DefaultParticipantMenuProps {
    participant: ClientView;
}

function DefaultParticipantMenu({ participant }: DefaultParticipantMenuProps) {
    const { spotlightedParticipants } = useGridParticipants();
    const isSpotlighted = spotlightedParticipants.find((p) => p.id === participant.id);
    const { isHovered, maximizedParticipant, floatingParticipant } = useGridCell();
    const isMaximized = maximizedParticipant?.id === participant.id;
    const isFloating = floatingParticipant?.id === participant.id;

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
                {participant.isLocalClient ? (
                    <ParticipantMenuItem
                        participantAction={"float"}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                        }}
                    >
                        {isFloating ? (
                            <>
                                <PopInIcon height={16} width={16} />
                                Move to grid
                            </>
                        ) : (
                            <>
                                <PopOutIcon height={16} width={16} />
                                Pop out
                            </>
                        )}
                    </ParticipantMenuItem>
                ) : null}
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
