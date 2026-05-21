declare module "*.wasm" {
    const content: string;
    export default content;
}

declare module "*?url" {
    const content: string;
    export default content;
}
