import type { AdminUser, CreateUserData, PublicAdminUser, PublicHandleIdentity, StoredAdminUserData } from './types.js';
export declare class AdminUserRepository {
    private cache;
    private sanitizeUser;
    private sanitizePublicHandleIdentity;
    private readUsers;
    private writeUsers;
    findByHandle(handle: string): Promise<AdminUser | null>;
    findByHandlePublic(handle: string): Promise<PublicAdminUser | null>;
    findPublicHandleIdentity(handle: string): Promise<PublicHandleIdentity | null>;
    findById(id: string): Promise<AdminUser | null>;
    findByIdPublic(id: string): Promise<PublicAdminUser | null>;
    findByGitHubId(githubId: number): Promise<AdminUser | null>;
    linkGitHub(userId: string, githubId: number, githubLogin: string): Promise<AdminUser>;
    unlinkGitHub(userId: string): Promise<AdminUser>;
    findByEmail(email: string): Promise<AdminUser | null>;
    findByEmailPublic(email: string): Promise<PublicAdminUser | null>;
    findAll(): Promise<AdminUser[]>;
    findAllPublic(): Promise<PublicAdminUser[]>;
    findAllPublicHandleIdentities(): Promise<PublicHandleIdentity[]>;
    create(userData: CreateUserData): Promise<AdminUser>;
    createStoredUser(userData: StoredAdminUserData): Promise<AdminUser>;
    update(id: string, updates: Partial<AdminUser>): Promise<AdminUser>;
    delete(id: string): Promise<void>;
    deletePermanently(id: string): Promise<boolean>;
    verifyPassword(handle: string, password: string): Promise<AdminUser | null>;
    updatePassword(id: string, newPassword: string): Promise<void>;
    enableTotp(id: string, secretId: string): Promise<void>;
    disableTotp(id: string): Promise<void>;
    hasAnyUsers(): Promise<boolean>;
    updateLastLogin(id: string): Promise<void>;
    needsFirstLoginSetup(id: string): Promise<boolean>;
    clearCache(): void;
}
export declare const adminUserRepository: AdminUserRepository;
//# sourceMappingURL=repository.d.ts.map