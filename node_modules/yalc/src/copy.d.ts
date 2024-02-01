export declare const getFileHash: (srcPath: string, relPath?: string) => Promise<string>;
export declare const copyPackageToStore: (options: {
    workingDir: string;
    signature?: boolean | undefined;
    changed?: boolean | undefined;
    files?: boolean | undefined;
    devMod?: boolean | undefined;
    workspaceResolve?: boolean | undefined;
}) => Promise<string | false>;
