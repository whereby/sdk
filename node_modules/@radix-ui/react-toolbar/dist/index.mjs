import $72MJ6$babelruntimehelpersesmextends from "@babel/runtime/helpers/esm/extends";
import {forwardRef as $72MJ6$forwardRef, createElement as $72MJ6$createElement} from "react";
import {composeEventHandlers as $72MJ6$composeEventHandlers} from "@radix-ui/primitive";
import {createContextScope as $72MJ6$createContextScope} from "@radix-ui/react-context";
import {createRovingFocusGroupScope as $72MJ6$createRovingFocusGroupScope, Root as $72MJ6$Root, Item as $72MJ6$Item} from "@radix-ui/react-roving-focus";
import {Primitive as $72MJ6$Primitive} from "@radix-ui/react-primitive";
import {Root as $72MJ6$Root1} from "@radix-ui/react-separator";
import {createToggleGroupScope as $72MJ6$createToggleGroupScope, Root as $72MJ6$Root2, Item as $72MJ6$Item1} from "@radix-ui/react-toggle-group";
import {useDirection as $72MJ6$useDirection} from "@radix-ui/react-direction";












/* -------------------------------------------------------------------------------------------------
 * Toolbar
 * -----------------------------------------------------------------------------------------------*/ const $3dc4ded751c8bdfb$var$TOOLBAR_NAME = 'Toolbar';
const [$3dc4ded751c8bdfb$var$createToolbarContext, $3dc4ded751c8bdfb$export$233e637670877d91] = $72MJ6$createContextScope($3dc4ded751c8bdfb$var$TOOLBAR_NAME, [
    $72MJ6$createRovingFocusGroupScope,
    $72MJ6$createToggleGroupScope
]);
const $3dc4ded751c8bdfb$var$useRovingFocusGroupScope = $72MJ6$createRovingFocusGroupScope();
const $3dc4ded751c8bdfb$var$useToggleGroupScope = $72MJ6$createToggleGroupScope();
const [$3dc4ded751c8bdfb$var$ToolbarProvider, $3dc4ded751c8bdfb$var$useToolbarContext] = $3dc4ded751c8bdfb$var$createToolbarContext($3dc4ded751c8bdfb$var$TOOLBAR_NAME);
const $3dc4ded751c8bdfb$export$4c260019440d418f = /*#__PURE__*/ $72MJ6$forwardRef((props, forwardedRef)=>{
    const { __scopeToolbar: __scopeToolbar , orientation: orientation = 'horizontal' , dir: dir , loop: loop = true , ...toolbarProps } = props;
    const rovingFocusGroupScope = $3dc4ded751c8bdfb$var$useRovingFocusGroupScope(__scopeToolbar);
    const direction = $72MJ6$useDirection(dir);
    return /*#__PURE__*/ $72MJ6$createElement($3dc4ded751c8bdfb$var$ToolbarProvider, {
        scope: __scopeToolbar,
        orientation: orientation,
        dir: direction
    }, /*#__PURE__*/ $72MJ6$createElement($72MJ6$Root, $72MJ6$babelruntimehelpersesmextends({
        asChild: true
    }, rovingFocusGroupScope, {
        orientation: orientation,
        dir: direction,
        loop: loop
    }), /*#__PURE__*/ $72MJ6$createElement($72MJ6$Primitive.div, $72MJ6$babelruntimehelpersesmextends({
        role: "toolbar",
        "aria-orientation": orientation,
        dir: direction
    }, toolbarProps, {
        ref: forwardedRef
    }))));
});
/*#__PURE__*/ Object.assign($3dc4ded751c8bdfb$export$4c260019440d418f, {
    displayName: $3dc4ded751c8bdfb$var$TOOLBAR_NAME
});
/* -------------------------------------------------------------------------------------------------
 * ToolbarSeparator
 * -----------------------------------------------------------------------------------------------*/ const $3dc4ded751c8bdfb$var$SEPARATOR_NAME = 'ToolbarSeparator';
const $3dc4ded751c8bdfb$export$291e1a31e8ec7868 = /*#__PURE__*/ $72MJ6$forwardRef((props, forwardedRef)=>{
    const { __scopeToolbar: __scopeToolbar , ...separatorProps } = props;
    const context = $3dc4ded751c8bdfb$var$useToolbarContext($3dc4ded751c8bdfb$var$SEPARATOR_NAME, __scopeToolbar);
    return /*#__PURE__*/ $72MJ6$createElement($72MJ6$Root1, $72MJ6$babelruntimehelpersesmextends({
        orientation: context.orientation === 'horizontal' ? 'vertical' : 'horizontal'
    }, separatorProps, {
        ref: forwardedRef
    }));
});
/*#__PURE__*/ Object.assign($3dc4ded751c8bdfb$export$291e1a31e8ec7868, {
    displayName: $3dc4ded751c8bdfb$var$SEPARATOR_NAME
});
/* -------------------------------------------------------------------------------------------------
 * ToolbarButton
 * -----------------------------------------------------------------------------------------------*/ const $3dc4ded751c8bdfb$var$BUTTON_NAME = 'ToolbarButton';
const $3dc4ded751c8bdfb$export$e5c1a33878e86e9e = /*#__PURE__*/ $72MJ6$forwardRef((props, forwardedRef)=>{
    const { __scopeToolbar: __scopeToolbar , ...buttonProps } = props;
    const rovingFocusGroupScope = $3dc4ded751c8bdfb$var$useRovingFocusGroupScope(__scopeToolbar);
    return /*#__PURE__*/ $72MJ6$createElement($72MJ6$Item, $72MJ6$babelruntimehelpersesmextends({
        asChild: true
    }, rovingFocusGroupScope, {
        focusable: !props.disabled
    }), /*#__PURE__*/ $72MJ6$createElement($72MJ6$Primitive.button, $72MJ6$babelruntimehelpersesmextends({
        type: "button"
    }, buttonProps, {
        ref: forwardedRef
    })));
});
/*#__PURE__*/ Object.assign($3dc4ded751c8bdfb$export$e5c1a33878e86e9e, {
    displayName: $3dc4ded751c8bdfb$var$BUTTON_NAME
});
/* -------------------------------------------------------------------------------------------------
 * ToolbarLink
 * -----------------------------------------------------------------------------------------------*/ const $3dc4ded751c8bdfb$var$LINK_NAME = 'ToolbarLink';
const $3dc4ded751c8bdfb$export$ff5714eba66809fd = /*#__PURE__*/ $72MJ6$forwardRef((props, forwardedRef)=>{
    const { __scopeToolbar: __scopeToolbar , ...linkProps } = props;
    const rovingFocusGroupScope = $3dc4ded751c8bdfb$var$useRovingFocusGroupScope(__scopeToolbar);
    return /*#__PURE__*/ $72MJ6$createElement($72MJ6$Item, $72MJ6$babelruntimehelpersesmextends({
        asChild: true
    }, rovingFocusGroupScope, {
        focusable: true
    }), /*#__PURE__*/ $72MJ6$createElement($72MJ6$Primitive.a, $72MJ6$babelruntimehelpersesmextends({}, linkProps, {
        ref: forwardedRef,
        onKeyDown: $72MJ6$composeEventHandlers(props.onKeyDown, (event)=>{
            if (event.key === ' ') event.currentTarget.click();
        })
    })));
});
/*#__PURE__*/ Object.assign($3dc4ded751c8bdfb$export$ff5714eba66809fd, {
    displayName: $3dc4ded751c8bdfb$var$LINK_NAME
});
/* -------------------------------------------------------------------------------------------------
 * ToolbarToggleGroup
 * -----------------------------------------------------------------------------------------------*/ const $3dc4ded751c8bdfb$var$TOGGLE_GROUP_NAME = 'ToolbarToggleGroup';
const $3dc4ded751c8bdfb$export$aeae28cb17562c0b = /*#__PURE__*/ $72MJ6$forwardRef((props, forwardedRef)=>{
    const { __scopeToolbar: __scopeToolbar , ...toggleGroupProps } = props;
    const context = $3dc4ded751c8bdfb$var$useToolbarContext($3dc4ded751c8bdfb$var$TOGGLE_GROUP_NAME, __scopeToolbar);
    const toggleGroupScope = $3dc4ded751c8bdfb$var$useToggleGroupScope(__scopeToolbar);
    return /*#__PURE__*/ $72MJ6$createElement($72MJ6$Root2, $72MJ6$babelruntimehelpersesmextends({
        "data-orientation": context.orientation,
        dir: context.dir
    }, toggleGroupScope, toggleGroupProps, {
        ref: forwardedRef,
        rovingFocus: false
    }));
});
/*#__PURE__*/ Object.assign($3dc4ded751c8bdfb$export$aeae28cb17562c0b, {
    displayName: $3dc4ded751c8bdfb$var$TOGGLE_GROUP_NAME
});
/* -------------------------------------------------------------------------------------------------
 * ToolbarToggleItem
 * -----------------------------------------------------------------------------------------------*/ const $3dc4ded751c8bdfb$var$TOGGLE_ITEM_NAME = 'ToolbarToggleItem';
const $3dc4ded751c8bdfb$export$546b879b639844a1 = /*#__PURE__*/ $72MJ6$forwardRef((props, forwardedRef)=>{
    const { __scopeToolbar: __scopeToolbar , ...toggleItemProps } = props;
    const toggleGroupScope = $3dc4ded751c8bdfb$var$useToggleGroupScope(__scopeToolbar);
    const scope = {
        __scopeToolbar: props.__scopeToolbar
    };
    return /*#__PURE__*/ $72MJ6$createElement($3dc4ded751c8bdfb$export$e5c1a33878e86e9e, $72MJ6$babelruntimehelpersesmextends({
        asChild: true
    }, scope), /*#__PURE__*/ $72MJ6$createElement($72MJ6$Item1, $72MJ6$babelruntimehelpersesmextends({}, toggleGroupScope, toggleItemProps, {
        ref: forwardedRef
    })));
});
/*#__PURE__*/ Object.assign($3dc4ded751c8bdfb$export$546b879b639844a1, {
    displayName: $3dc4ded751c8bdfb$var$TOGGLE_ITEM_NAME
});
/* ---------------------------------------------------------------------------------------------- */ const $3dc4ded751c8bdfb$export$be92b6f5f03c0fe9 = $3dc4ded751c8bdfb$export$4c260019440d418f;
const $3dc4ded751c8bdfb$export$1ff3c3f08ae963c0 = $3dc4ded751c8bdfb$export$291e1a31e8ec7868;
const $3dc4ded751c8bdfb$export$353f5b6fc5456de1 = $3dc4ded751c8bdfb$export$e5c1a33878e86e9e;
const $3dc4ded751c8bdfb$export$a6c7ac8248d6e38a = $3dc4ded751c8bdfb$export$ff5714eba66809fd;
const $3dc4ded751c8bdfb$export$af3ec21f6cfb5e30 = $3dc4ded751c8bdfb$export$aeae28cb17562c0b;
const $3dc4ded751c8bdfb$export$920ad4cf87b18fc7 = $3dc4ded751c8bdfb$export$546b879b639844a1;




export {$3dc4ded751c8bdfb$export$233e637670877d91 as createToolbarScope, $3dc4ded751c8bdfb$export$4c260019440d418f as Toolbar, $3dc4ded751c8bdfb$export$291e1a31e8ec7868 as ToolbarSeparator, $3dc4ded751c8bdfb$export$e5c1a33878e86e9e as ToolbarButton, $3dc4ded751c8bdfb$export$ff5714eba66809fd as ToolbarLink, $3dc4ded751c8bdfb$export$aeae28cb17562c0b as ToolbarToggleGroup, $3dc4ded751c8bdfb$export$546b879b639844a1 as ToolbarToggleItem, $3dc4ded751c8bdfb$export$be92b6f5f03c0fe9 as Root, $3dc4ded751c8bdfb$export$1ff3c3f08ae963c0 as Separator, $3dc4ded751c8bdfb$export$353f5b6fc5456de1 as Button, $3dc4ded751c8bdfb$export$a6c7ac8248d6e38a as Link, $3dc4ded751c8bdfb$export$af3ec21f6cfb5e30 as ToggleGroup, $3dc4ded751c8bdfb$export$920ad4cf87b18fc7 as ToggleItem};
//# sourceMappingURL=index.mjs.map
