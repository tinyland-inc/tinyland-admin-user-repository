import type { PublicHandleIdentity } from './types.js';
export type PublicHandleDirectorySourceModel = 'repository_backed_admin_identity' | (string & {});
export declare const PUBLIC_HANDLE_DIRECTORY_SOURCE_MODEL: PublicHandleDirectorySourceModel;
export declare const PUBLIC_HANDLE_DIRECTORY_BACKING_FILE: "content/auth/admin-users.json";
export declare const PUBLIC_HANDLE_DIRECTORY_BACKING_SURFACE: "content/auth/admin-users.json";
export type PublicHandleDirectoryBackingFile = typeof PUBLIC_HANDLE_DIRECTORY_BACKING_FILE | null;
export interface PublicHandleDirectorySource {
    readonly sourceModel: PublicHandleDirectorySourceModel;
    readonly backingSurface: string;
    readonly backingFile?: PublicHandleDirectoryBackingFile;
    findByHandle(handle: string): Promise<PublicHandleIdentity | null>;
    findAll(): Promise<PublicHandleIdentity[]>;
}
export interface PublicHandleDirectory {
    readonly sourceModel: PublicHandleDirectorySourceModel;
    readonly backingSurface: string;
    readonly backingFile: PublicHandleDirectoryBackingFile;
    findByHandle(handle: string): Promise<PublicHandleIdentity | null>;
    findAll(): Promise<PublicHandleIdentity[]>;
}
export declare const repositoryBackedPublicHandleDirectorySource: PublicHandleDirectorySource;
export declare function createPublicHandleDirectory(source: PublicHandleDirectorySource): PublicHandleDirectory;
export declare const publicHandleDirectory: PublicHandleDirectory;
//# sourceMappingURL=publicHandleDirectory.d.ts.map