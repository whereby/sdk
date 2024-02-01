import { PackageInstallation } from './installations';
export interface UpdatePackagesOptions {
    workingDir: string;
    noInstallationsRemove?: boolean;
    replace?: boolean;
    update?: boolean;
    restore?: boolean;
}
export declare const updatePackages: (packages: string[], options: UpdatePackagesOptions) => Promise<PackageInstallation[]>;
