/// <reference types="node" />
import { ExecSyncOptions } from 'child_process';
export declare const values: {
    myNameIs: string;
    ignoreFileName: string;
    myNameIsCapitalized: string;
    lockfileName: string;
    yalcPackagesFolder: string;
    prescript: string;
    postscript: string;
    installationsFile: string;
};
export interface UpdatePackagesOptions {
    safe?: boolean;
    workingDir: string;
}
export { publishPackage } from './publish';
export { updatePackages } from './update';
export { checkManifest } from './check';
export { removePackages } from './remove';
export { addPackages } from './add';
export * from './pkg';
export * from './pm';
export interface YalcGlobal {
    yalcStoreMainDir: string;
}
export declare const yalcGlobal: YalcGlobal;
export declare function getStoreMainDir(): string;
export declare function getStorePackagesDir(): string;
export declare const getPackageStoreDir: (packageName: string, version?: string) => string;
export declare const execLoudOptions: ExecSyncOptions;
export declare const readSignatureFile: (workingDir: string) => string;
export declare const readIgnoreFile: (workingDir: string) => string;
export declare const writeSignatureFile: (workingDir: string, signature: string) => void;
