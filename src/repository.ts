















import { promises as fs } from 'fs';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getConfig } from './config.js';
import type { AdminUser, CreateUserData } from './types.js';

export class AdminUserRepository {
	private cache: Map<string, { user: AdminUser; timestamp: number }> = new Map();

	


	private async readUsers(): Promise<AdminUser[]> {
		const { usersFilePath } = getConfig();
		try {
			const content = await fs.readFile(usersFilePath, 'utf8');
			const data = JSON.parse(content);

			
			return Array.isArray(data) ? data : (data.users || []);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				
				return [];
			}
			throw error;
		}
	}

	


	private async writeUsers(users: AdminUser[]): Promise<void> {
		const { usersFilePath, filePermissions } = getConfig();
		await fs.writeFile(
			usersFilePath,
			JSON.stringify(users, null, 2),
			'utf8'
		);

		
		
		try {
			await fs.chmod(usersFilePath, filePermissions);
		} catch (error) {
			
			console.warn('[AdminUserRepository] Failed to set file permissions:', error);
		}

		
		this.cache.clear();
	}

	


	async findByHandle(handle: string): Promise<AdminUser | null> {
		const { cacheTtl } = getConfig();

		
		const cached = this.cache.get(`handle:${handle}`);
		if (cached && Date.now() - cached.timestamp < cacheTtl) {
			return cached.user;
		}

		const users = await this.readUsers();
		const user = users.find((u: AdminUser) =>
			(u.handle === handle || u.username === handle) && u.isActive !== false
		);

		
		if (user) {
			this.cache.set(`handle:${handle}`, { user, timestamp: Date.now() });
		}

		return user || null;
	}

	


	async findById(id: string): Promise<AdminUser | null> {
		const { cacheTtl } = getConfig();

		
		const cached = this.cache.get(`id:${id}`);
		if (cached && Date.now() - cached.timestamp < cacheTtl) {
			return cached.user;
		}

		const users = await this.readUsers();
		const user = users.find((u: AdminUser) => u.id === id);

		
		if (user) {
			this.cache.set(`id:${id}`, { user, timestamp: Date.now() });
		}

		return user || null;
	}

	


	async findByEmail(email: string): Promise<AdminUser | null> {
		const users = await this.readUsers();
		return users.find((u: AdminUser) =>
			u.username === email && u.isActive !== false
		) || null;
	}

	


	async findAll(): Promise<AdminUser[]> {
		return await this.readUsers();
	}

	


	async create(userData: CreateUserData): Promise<AdminUser> {
		const { saltRounds } = getConfig();
		const users = await this.readUsers();

		
		const exists = users.some((u: AdminUser) =>
			u.handle === userData.handle || u.username === userData.handle
		);

		if (exists) {
			throw new Error(`User with handle '${userData.handle}' already exists`);
		}

		
		const passwordHash = await bcrypt.hash(userData.password, saltRounds);

		
		const newUser: AdminUser = {
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
		};

		users.push(newUser);
		await this.writeUsers(users);

		return newUser;
	}

	


	async update(id: string, updates: Partial<AdminUser>): Promise<AdminUser> {
		const users = await this.readUsers();
		const index = users.findIndex((u: AdminUser) => u.id === id);

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

	


	async delete(id: string): Promise<void> {
		await this.update(id, { isActive: false });
	}

	


	async verifyPassword(handle: string, password: string): Promise<AdminUser | null> {
		const user = await this.findByHandle(handle);

		if (!user || !user.passwordHash) {
			return null;
		}

		const isValid = await bcrypt.compare(password, user.passwordHash);
		return isValid ? user : null;
	}

	


	async updatePassword(id: string, newPassword: string): Promise<void> {
		const { saltRounds } = getConfig();
		const passwordHash = await bcrypt.hash(newPassword, saltRounds);
		await this.update(id, { passwordHash });
	}

	


	async enableTotp(id: string, secretId: string): Promise<void> {
		await this.update(id, {
			totpEnabled: true,
			totpSecretId: secretId,
		});
	}

	


	async disableTotp(id: string): Promise<void> {
		await this.update(id, {
			totpEnabled: false,
			totpSecretId: null,
		});
	}

	


	async hasAnyUsers(): Promise<boolean> {
		const users = await this.readUsers();
		return users.length > 0;
	}

	


	async updateLastLogin(id: string): Promise<void> {
		await this.update(id, {
			lastLoginAt: new Date().toISOString(),
		});
	}

	


	async needsFirstLoginSetup(id: string): Promise<boolean> {
		const user = await this.findById(id);
		if (!user) return false;

		return user.firstLogin === true;
	}

	


	clearCache(): void {
		this.cache.clear();
	}
}


export const adminUserRepository = new AdminUserRepository();
