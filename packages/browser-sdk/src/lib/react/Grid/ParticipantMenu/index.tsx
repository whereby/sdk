import * as React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "../../Popover";
import { useGridCell } from "../GridContext";
import { PopoverProps } from "@radix-ui/react-popover";
import { useAppDispatch, useAppSelector } from "../../Provider/hooks";
import { doRemoveSpotlight, doSpotlightParticipant, selectSpotlightedClientViews } from "@whereby.com/core";

type ParticipantMenuContextValue = {
    open: boolean;
    setOpen: (open: boolean) => void;
};

const ParticipantMenuContext = React.createContext<ParticipantMenuContextValue>({} as ParticipantMenuContextValue);

const useParticipantMenu = () => {
    const context = React.useContext(ParticipantMenuContext);
    const gridCellContext = useGridCell();

    if (!context) {
        throw new Error("useParticipantMenu must be used within a ParticipantMenu");
    }

    return {
        ...context,
        ...gridCellContext,
    };
};

const ParticipantMenu = (props: PopoverProps) => {
    const { children, ...rest } = props;
    const [open, setOpen] = React.useState(false);

    return (
        <ParticipantMenuContext.Provider value={{ open, setOpen }}>
            <Popover {...rest} open={open} onOpenChange={setOpen}>
                {children}
            </Popover>
        </ParticipantMenuContext.Provider>
    );
};

const ParticipantMenuContent = React.forwardRef<
    React.ElementRef<typeof PopoverContent>,
    React.ComponentPropsWithoutRef<typeof PopoverContent>
>(({ children, style, ...props }, ref) => {
    return (
        <PopoverContent
            ref={ref}
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                minWidth: "180px",
                maxWidth: "300px",
                maxHeight: "100vh",
                overflowY: "auto",
                padding: 0,
                ...style,
            }}
            {...props}
        >
            {children}
        </PopoverContent>
    );
});

ParticipantMenuContent.displayName = "ParticipantMenuContent";

const ParticipantMenuTrigger = React.forwardRef<
    React.ElementRef<typeof PopoverTrigger>,
    React.ComponentPropsWithoutRef<typeof PopoverTrigger>
>(({ children, style, ...props }, ref) => {
    return (
        <PopoverTrigger
            ref={ref}
            style={{
                position: "absolute",
                top: "10px",
                right: "20px",
                textDecoration: "none",
                whiteSpace: "nowrap",
                border: "none",
                cursor: "pointer",
                ...style,
            }}
            {...props}
        >
            {children}
        </PopoverTrigger>
    );
});

ParticipantMenuTrigger.displayName = PopoverTrigger.displayName;

type ParticipantMenuItemProps = React.ComponentPropsWithoutRef<"button"> & {
    participantAction?: "maximize" | "spotlight";
};

const ParticipantMenuItem = React.forwardRef<React.ElementRef<"button">, ParticipantMenuItemProps>(
    ({ children, style, participantAction, ...props }, ref) => {
        const { participant, setOpen, maximizedParticipant, setMaximizedParticipant } = useParticipantMenu();
        const dispatch = useAppDispatch();
        const spotlightedParticipants = useAppSelector(selectSpotlightedClientViews);
        const isSpotlighted = spotlightedParticipants.find((p) => p.id === participant.id);
        const isMaximized = maximizedParticipant?.id === participant.id;

        let onClick;

        switch (participantAction) {
            case "maximize":
                onClick = () => {
                    if (isMaximized) {
                        setMaximizedParticipant(null);
                    } else {
                        setMaximizedParticipant(participant);
                    }
                    setOpen(false);
                };
                break;
            case "spotlight":
                onClick = () => {
                    if (isSpotlighted) {
                        dispatch(doRemoveSpotlight({ id: participant.id }));
                    } else {
                        dispatch(doSpotlightParticipant({ id: participant.id }));
                    }
                    setOpen(false);
                };
                break;
            default:
                break;
        }

        return (
            <button
                ref={ref}
                role="menuitem"
                tabIndex={-1}
                onClick={onClick ?? props.onClick}
                style={{
                    alignItems: "stretch",
                    backgroundColor: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    height: "40px",
                    lineHeight: "40px",
                    minWidth: "140px",
                    padding: "0 12px",
                    textAlign: "left",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    width: "100%",
                    ...style,
                }}
                {...props}
            >
                {children}
            </button>
        );
    },
);

ParticipantMenuItem.displayName = "ParticipantMenuItem";

export { ParticipantMenu, ParticipantMenuTrigger, ParticipantMenuContent, ParticipantMenuItem };
