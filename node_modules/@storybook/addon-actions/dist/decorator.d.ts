declare global {
	interface SymbolConstructor {
		readonly observable: symbol;
	}
}
interface Args {
    [name: string]: any;
}
interface Globals {
    [name: string]: any;
}
type Renderer = {
    /** What is the type of the `component` annotation in this renderer? */
    component: unknown;
    /** What does the story function return in this renderer? */
    storyResult: unknown;
    /** What type of element does this renderer render to? */
    canvasElement: unknown;
    T?: unknown;
};
interface StoryContextUpdate<TArgs = Args> {
    args?: TArgs;
    globals?: Globals;
    [key: string]: any;
}
type PartialStoryFn<TRenderer extends Renderer = Renderer, TArgs = Args> = (update?: StoryContextUpdate<Partial<TArgs>>) => TRenderer['storyResult'];

declare const withActions: <T extends Renderer>(storyFn: PartialStoryFn<T>) => T['storyResult'];

export { withActions };
