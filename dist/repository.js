import { promises as fs } from 'fs';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getConfig } from './config.js';
export class AdminUserRepository {
    cache = new Map();
    sanitizeUser(user) {
        const { passwordHash, totpSecretId, ...sanitized } = user;
        return sanitized;
    }
    sanitizePublicHandleIdentity(user) {
        return {
            id: user.id,
            username: user.username,
            handle: user.handle,
            displayName: user.displayName,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            bannerUrl: user.bannerUrl,
            website: user.website,
            location: user.location,
            pronouns: user.pronouns,
            githubLogin: user.githubLogin ?? null,
            githubLinkedAt: user.githubLinkedAt ?? null,
        };
    }
    async readUsers() {
        const { usersFilePath } = getConfig();
        try {
            const content = await fs.readFile(usersFilePath, 'utf8');
            const data = JSON.parse(content);
            return Array.isArray(data) ? data : (data.users || []);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }
    async writeUsers(users) {
        const { usersFilePath, filePermissions } = getConfig();
        await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
        try {
            await fs.chmod(usersFilePath, filePermissions);
        }
        catch (error) {
            console.warn('[AdminUserRepository] Failed to set file permissions:', error);
        }
        this.cache.clear();
    }
    async findByHandle(handle) {
        const { cacheTtl } = getConfig();
        const cached = this.cache.get(`handle:${handle}`);
        if (cached && Date.now() - cached.timestamp < cacheTtl) {
            return cached.user;
        }
        const users = await this.readUsers();
        const user = users.find((u) => (u.handle === handle || u.username === handle) && u.isActive !== false);
        if (user) {
            this.cache.set(`handle:${handle}`, { user, timestamp: Date.now() });
        }
        return user || null;
    }
    async findByHandlePublic(handle) {
        const user = await this.findByHandle(handle);
        return user ? this.sanitizeUser(user) : null;
    }
    async findPublicHandleIdentity(handle) {
        const user = await this.findByHandle(handle);
        return user ? this.sanitizePublicHandleIdentity(user) : null;
    }
    async findById(id) {
        const { cacheTtl } = getConfig();
        const cached = this.cache.get(`id:${id}`);
        if (cached && Date.now() - cached.timestamp < cacheTtl) {
            return cached.user;
        }
        const users = await this.readUsers();
        const user = users.find((u) => u.id === id);
        if (user) {
            this.cache.set(`id:${id}`, { user, timestamp: Date.now() });
        }
        return user || null;
    }
    async findByIdPublic(id) {
        const user = await this.findById(id);
        return user ? this.sanitizeUser(user) : null;
    }
    async findByGitHubId(githubId) {
        const users = await this.readUsers();
        return users.find((u) => u.githubId === githubId && u.isActive !== false) || null;
    }
    async linkGitHub(userId, githubId, githubLogin) {
        const existing = await this.findByGitHubId(githubId);
        if (existing && existing.id !== userId) {
            throw new Error(`GitHub account ${githubLogin} is already linked to another admin user`);
        }
        return this.update(userId, {
            githubId,
            githubLogin,
            githubLinkedAt: new Date().toISOString(),
        });
    }
    async unlinkGitHub(userId) {
        return this.update(userId, {
            githubId: null,
            githubLogin: null,
            githubLinkedAt: null,
        });
    }
    async findByEmail(email) {
        const users = await this.readUsers();
        return users.find((u) => u.username === email && u.isActive !== false) || null;
    }
    async findByEmailPublic(email) {
        const user = await this.findByEmail(email);
        return user ? this.sanitizeUser(user) : null;
    }
    async findAll() {
        return await this.readUsers();
    }
    async findAllPublic() {
        const users = await this.findAll();
        return users.map((user) => this.sanitizeUser(user));
    }
    async findAllPublicHandleIdentities() {
        const users = await this.findAll();
        return users
            .filter((user) => user.isActive !== false)
            .map((user) => this.sanitizePublicHandleIdentity(user));
    }
    async create(userData) {
        const { saltRounds } = getConfig();
        const users = await this.readUsers();
        const exists = users.some((u) => u.handle === userData.handle || u.username === userData.handle);
        if (exists) {
            throw new Error(`User with handle '${userData.handle}' already exists`);
        }
        const passwordHash = await bcrypt.hash(userData.password, saltRounds);
        const newUser = {
            id: crypto.randomUUID(),
            username: userData.handle,
            handle: userData.handle,
            passwordHash,
            role: userData.role || 'admin',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastLoginAt: null,
            permissions: [],
            totpEnabled: userData.totpEnabled || false,
            totpSecretId: userData.totpSecretId || null,
            needsOnboarding: false,
            onboardingStep: 0,
            firstLogin: false,
            githubId: userData.githubId || null,
            githubLogin: userData.githubLogin || null,
            githubLinkedAt: userData.githubId ? new Date().toISOString() : null,
        };
        users.push(newUser);
        await this.writeUsers(users);
        return newUser;
    }
    async createStoredUser(userData) {
        const users = await this.readUsers();
        const handle = userData.handle ?? userData.username;
        if (!handle) {
            throw new Error('Stored admin user must include a handle or username');
        }
        const exists = users.some((u) => u.handle === handle || u.username === handle);
        if (exists) {
            throw new Error(`User with handle '${handle}' already exists`);
        }
        const timestamp = new Date().toISOString();
        const newUser = {
            id: userData.id ?? crypto.randomUUID(),
            username: userData.username ?? handle,
            handle,
            displayName: userData.displayName,
            email: userData.email,
            passwordHash: userData.passwordHash,
            role: userData.role,
            isActive: userData.isActive ?? true,
            createdAt: userData.createdAt ?? timestamp,
            updatedAt: userData.updatedAt ?? timestamp,
            lastLoginAt: userData.lastLoginAt ?? null,
            lastLogin: userData.lastLogin ?? null,
            permissions: userData.permissions ?? [],
            totpEnabled: userData.totpEnabled ?? false,
            totpSecretId: userData.totpSecretId ?? null,
            needsOnboarding: userData.needsOnboarding ?? false,
            onboardingStep: userData.onboardingStep ?? 0,
            firstLogin: userData.firstLogin ?? false,
            githubId: userData.githubId ?? null,
            githubLogin: userData.githubLogin ?? null,
            githubLinkedAt: userData.githubLinkedAt ?? null,
        };
        users.push(newUser);
        await this.writeUsers(users);
        return newUser;
    }
    async update(id, updates) {
        const users = await this.readUsers();
        const index = users.findIndex((u) => u.id === id);
        if (index === -1) {
            throw new Error(`User with id '${id}' not found`);
        }
        users[index] = {
            ...users[index],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        await this.writeUsers(users);
        return users[index];
    }
    async delete(id) {
        await this.update(id, { isActive: false });
    }
    async deletePermanently(id) {
        const users = await this.readUsers();
        const index = users.findIndex((u) => u.id === id);
        if (index === -1) {
            return false;
        }
        users.splice(index, 1);
        await this.writeUsers(users);
        return true;
    }
    async verifyPassword(handle, password) {
        const user = await this.findByHandle(handle);
        if (!user || !user.passwordHash) {
            return null;
        }
        const isValid = await bcrypt.compare(password, user.passwordHash);
        return isValid ? user : null;
    }
    async updatePassword(id, newPassword) {
        const { saltRounds } = getConfig();
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);
        await this.update(id, { passwordHash });
    }
    async enableTotp(id, secretId) {
        await this.update(id, {
            totpEnabled: true,
            totpSecretId: secretId,
        });
    }
    async disableTotp(id) {
        await this.update(id, {
            totpEnabled: false,
            totpSecretId: null,
        });
    }
    async hasAnyUsers() {
        const users = await this.readUsers();
        return users.length > 0;
    }
    async updateLastLogin(id) {
        await this.update(id, {
            lastLoginAt: new Date().toISOString(),
        });
    }
    async needsFirstLoginSetup(id) {
        const user = await this.findById(id);
        if (!user)
            return false;
        return user.firstLogin === true;
    }
    clearCache() {
        this.cache.clear();
    }
}
export const adminUserRepository = new AdminUserRepository();
