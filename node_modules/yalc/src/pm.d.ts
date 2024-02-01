declare type PackageMangerName = 'yarn' | 'npm' | 'pnpm';
export declare const pmMarkFiles: {
    [P in PackageMangerName]: string[];
};
export declare const pmInstallCmd: {
    [P in PackageMangerName]: string;
};
export declare const pmUpdateCmd: {
    [P in PackageMangerName]: string;
};
export declare const pmRunScriptCmd: {
    [P in PackageMangerName]: string;
};
export declare const getPackageManager: (cwd: string) => PackageMangerName;
export declare const getRunScriptCmd: (cwd: string) => string;
export declare const getPackageManagerInstallCmd: (cwd: string) => string;
export declare const getPackageManagerUpdateCmd: (cwd: string) => string;
export declare const isYarn: (cwd: string) => boolean;
export declare const runPmUpdate: (workingDir: string, packages: string[]) => void;
export {};
