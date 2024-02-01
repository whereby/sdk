import * as React from "react";
import * as RovingFocusGroup from "@radix-ui/react-roving-focus";
import * as Radix from "@radix-ui/react-primitive";
import { Primitive } from "@radix-ui/react-primitive";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
export const createToolbarScope: import("@radix-ui/react-context").CreateScope;
type RovingFocusGroupProps = Radix.ComponentPropsWithoutRef<typeof RovingFocusGroup.Root>;
type PrimitiveDivProps = Radix.ComponentPropsWithoutRef<typeof Primitive.div>;
export interface ToolbarProps extends PrimitiveDivProps {
    orientation?: RovingFocusGroupProps['orientation'];
    loop?: RovingFocusGroupProps['loop'];
    dir?: RovingFocusGroupProps['dir'];
}
export const Toolbar: React.ForwardRefExoticComponent<ToolbarProps & React.RefAttributes<HTMLDivElement>>;
type SeparatorProps = Radix.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>;
export interface ToolbarSeparatorProps extends SeparatorProps {
}
export const ToolbarSeparator: React.ForwardRefExoticComponent<ToolbarSeparatorProps & React.RefAttributes<HTMLDivElement>>;
type PrimitiveButtonProps = Radix.ComponentPropsWithoutRef<typeof Primitive.button>;
export interface ToolbarButtonProps extends PrimitiveButtonProps {
}
export const ToolbarButton: React.ForwardRefExoticComponent<ToolbarButtonProps & React.RefAttributes<HTMLButtonElement>>;
type PrimitiveLinkProps = Radix.ComponentPropsWithoutRef<typeof Primitive.a>;
export interface ToolbarLinkProps extends PrimitiveLinkProps {
}
export const ToolbarLink: React.ForwardRefExoticComponent<ToolbarLinkProps & React.RefAttributes<HTMLAnchorElement>>;
type ToggleGroupProps = Radix.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>;
export interface ToolbarToggleGroupSingleProps extends Extract<ToggleGroupProps, {
    type: 'single';
}> {
}
export interface ToolbarToggleGroupMultipleProps extends Extract<ToggleGroupProps, {
    type: 'multiple';
}> {
}
export const ToolbarToggleGroup: React.ForwardRefExoticComponent<(ToolbarToggleGroupSingleProps | ToolbarToggleGroupMultipleProps) & React.RefAttributes<HTMLDivElement>>;
type ToggleGroupItemProps = Radix.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>;
export interface ToolbarToggleItemProps extends ToggleGroupItemProps {
}
export const ToolbarToggleItem: React.ForwardRefExoticComponent<ToolbarToggleItemProps & React.RefAttributes<HTMLButtonElement>>;
export const Root: React.ForwardRefExoticComponent<ToolbarProps & React.RefAttributes<HTMLDivElement>>;
export const Separator: React.ForwardRefExoticComponent<ToolbarSeparatorProps & React.RefAttributes<HTMLDivElement>>;
export const Button: React.ForwardRefExoticComponent<ToolbarButtonProps & React.RefAttributes<HTMLButtonElement>>;
export const Link: React.ForwardRefExoticComponent<ToolbarLinkProps & React.RefAttributes<HTMLAnchorElement>>;
export const ToggleGroup: React.ForwardRefExoticComponent<(ToolbarToggleGroupSingleProps | ToolbarToggleGroupMultipleProps) & React.RefAttributes<HTMLDivElement>>;
export const ToggleItem: React.ForwardRefExoticComponent<ToolbarToggleItemProps & React.RefAttributes<HTMLButtonElement>>;

//# sourceMappingURL=index.d.ts.map
