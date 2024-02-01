declare global {
	interface SymbolConstructor {
		readonly observable: symbol;
	}
}

type StoryId = string;
type ComponentTitle = string;
type StoryName = string;
/** @deprecated */
type StoryKind = ComponentTitle;

export { ComponentTitle as C, StoryKind as S, StoryName as a, StoryId as b };
