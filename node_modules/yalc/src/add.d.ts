export interface AddPackagesOptions {
    dev?: boolean;
    link?: boolean;
    linkDep?: boolean;
    replace?: boolean;
    update?: boolean;
    safe?: boolean;
    pure?: boolean;
    restore?: boolean;
    workspace?: boolean;
    workingDir: string;
}
export declare const addPackages: (packages: string[], options: AddPackagesOptions) => Promise<void>;
