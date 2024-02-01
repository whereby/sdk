export interface PublishPackageOptions {
    workingDir: string;
    signature?: boolean;
    changed?: boolean;
    push?: boolean;
    update?: boolean;
    replace?: boolean;
    npm?: boolean;
    files?: boolean;
    private?: boolean;
    scripts?: boolean;
    devMod?: boolean;
    workspaceResolve?: boolean;
}
export declare const publishPackage: (options: PublishPackageOptions) => Promise<void>;
