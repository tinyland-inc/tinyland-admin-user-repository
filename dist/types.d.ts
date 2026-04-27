export interface AdminUser {
    id: string;
    username: string;
    handle?: string;
    displayName?: string;
    email?: string;
    passwordHash?: string;
    role: string;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
    lastLoginAt?: string | null;
    lastLogin?: string | null;
    permissions?: string[];
    totpEnabled?: boolean;
    totpSecretId?: string | null;
    needsOnboarding?: boolean;
    onboardingStep?: number;
    firstLogin?: boolean;
    githubId?: number | null;
    githubLogin?: string | null;
    githubLinkedAt?: string | null;
    [key: string]: unknown;
}
export type PublicAdminUser = Omit<AdminUser, 'passwordHash' | 'totpSecretId'>;
export interface PublicHandleIdentity {
    id: string;
    username: string;
    handle?: string;
    displayName?: string;
    role: string;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
    bio?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    website?: string;
    location?: string;
    pronouns?: string;
    githubLogin?: string | null;
    githubLinkedAt?: string | null;
}
export interface StoredAdminUserData {
    id?: string;
    username?: string;
    handle?: string;
    displayName?: string;
    email?: string;
    passwordHash?: string;
    role: string;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
    lastLoginAt?: string | null;
    lastLogin?: string | null;
    permissions?: string[];
    totpEnabled?: boolean;
    totpSecretId?: string | null;
    needsOnboarding?: boolean;
    onboardingStep?: number;
    firstLogin?: boolean;
    githubId?: number | null;
    githubLogin?: string | null;
    githubLinkedAt?: string | null;
    [key: string]: unknown;
}
export interface CreateUserData {
    handle: string;
    password: string;
    role?: string;
    email?: string;
    totpEnabled?: boolean;
    totpSecretId?: string;
    githubId?: number;
    githubLogin?: string;
}
//# sourceMappingURL=types.d.ts.map