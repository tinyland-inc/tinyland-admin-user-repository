import { adminUserRepository } from './repository.js';
export const PUBLIC_HANDLE_DIRECTORY_SOURCE_MODEL = 'repository_backed_admin_identity';
export const PUBLIC_HANDLE_DIRECTORY_BACKING_FILE = 'content/auth/admin-users.json';
export const PUBLIC_HANDLE_DIRECTORY_BACKING_SURFACE = PUBLIC_HANDLE_DIRECTORY_BACKING_FILE;
class DefaultPublicHandleDirectory {
    source;
    sourceModel;
    backingSurface;
    backingFile;
    constructor(source) {
        this.source = source;
        this.sourceModel = source.sourceModel;
        this.backingSurface = source.backingSurface;
        this.backingFile = source.backingFile ?? null;
    }
    async findByHandle(handle) {
        return this.source.findByHandle(handle);
    }
    async findAll() {
        return this.source.findAll();
    }
}
export const repositoryBackedPublicHandleDirectorySource = {
    sourceModel: PUBLIC_HANDLE_DIRECTORY_SOURCE_MODEL,
    backingSurface: PUBLIC_HANDLE_DIRECTORY_BACKING_SURFACE,
    backingFile: PUBLIC_HANDLE_DIRECTORY_BACKING_FILE,
    findByHandle: (handle) => adminUserRepository.findPublicHandleIdentity(handle),
    findAll: () => adminUserRepository.findAllPublicHandleIdentities(),
};
export function createPublicHandleDirectory(source) {
    return new DefaultPublicHandleDirectory(source);
}
export const publicHandleDirectory = createPublicHandleDirectory(repositoryBackedPublicHandleDirectorySource);
