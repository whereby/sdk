import { S as StoryKind, C as ComponentTitle, a as StoryName } from '../index.d-3adcfc00.js';
import React, { PureComponent, ReactNode } from 'react';

interface Props {
    kind?: StoryKind;
    title?: ComponentTitle;
    story?: StoryName;
    name?: StoryName;
    children: ReactNode;
}
interface State {
    href: string;
}
declare class LinkTo extends PureComponent<Props, State> {
    static defaultProps: Props;
    state: State;
    componentDidMount(): void;
    componentDidUpdate(prevProps: Props): void;
    updateHref: () => Promise<void>;
    handleClick: () => void;
    render(): React.JSX.Element;
}

export { LinkTo as default };
