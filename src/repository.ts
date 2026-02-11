/**
 * AdminUserRepository - Centralized Data Access Layer
 *
 * Single source of truth for all admin user data operations.
 * Uses flat-file JSON storage with in-memory cache.
 *
 * Benefits:
 * - Centralized error handling
 * - Consistent data access patterns
 * - In-memory caching with configurable TTL
 * - Framework-agnostic (no SvelteKit dependency)
 * - Testable and mockable
 *
 * @module repository
 */

import { promises as fs } from 'fs';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getConfig } from './config.js';
import type { AdminUser, CreateUserData } from './types.js';

export class AdminUserRepository {
	private cache: Map<string, { user: AdminUser; timestamp: number }> = new Map();

	/**
	 * Read all users from file
	 */
	private async readUsers(): Promise<AdminUser[]> {
		const { usersFilePath } = getConfig();
		try {
			const content = await fs.readFile(usersFilePath, 'utf8');
			const data = JSON.parse(content);

			// Handle both formats: array or object with users property
			return Array.isArray(data) ? data : (data.users || []);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				// File doesn't exist, return empty array
				return [];
			}
			throw error;
		}
	}

	/**
	 * Write all users to file
	 */
	private async writeUsers(users: AdminUser[]): Promise<void> {
		const { usersFilePath, filePermissions } = getConfig();
		await fs.writeFile(
			usersFilePath,
			JSON.stringify(users, null, 2),
			'utf8'
		);

		// CRITICAL: Ensure container-writable permissions
		// Container user (uid 1001) needs write access for admin operations
		try {
			await fs.chmod(usersFilePath, filePermissions);
		} catch (error) {
			// Don't fail if chmod fails (e.g., file system doesn't support it)
			console.warn('[AdminUserRepository] Failed to set file permissions:', error);
		}

		// Clear cache on write
		this.cache.clear();
	}

	/**
	 * Find user by handle
	 */
	async findByHandle(handle: string): Promise<AdminUser | null> {
		const { cacheTtl } = getConfig();

		// Check cache first
		const cached = this.cache.get(`handle:${handle}`);
		if (cached && Date.now() - cached.timestamp < cacheTtl) {
			return cached.user;
		}

		const users = await this.readUsers();
		const user = users.find((u: AdminUser) =>
			(u.handle === handle || u.username === handle) && u.isActive !== false
		);

		// Cache the result
		if (user) {
			this.cache.set(`handle:${handle}`, { user, timestamp: Date.now() });
		}

		return user || null;
	}

	/**
	 * Find user by ID
	 */
	async findById(id: string): Promise<AdminUser | null> {
		const { cacheTtl } = getConfig();

		// Check cache first
		const cached = this.cache.get(`id:${id}`);
		if (cached && Date.now() - cached.timestamp < cacheTtl) {
			return cached.user;
		}

		const users = await this.readUsers();
		const user = users.find((u: AdminUser) => u.id === id);

		// Cache the result
		if (user) {
			this.cache.set(`id:${id}`, { user, timestamp: Date.now() });
		}

		return user || null;
	}

	/**
	 * Find user by email (legacy support)
	 */
	async findByEmail(email: string): Promise<AdminUser | null> {
		const users = await this.readUsers();
		return users.find((u: AdminUser) =>
			u.username === email && u.isActive !== false
		) || null;
	}

	/**
	 * Get all users
	 */
	async findAll(): Promise<AdminUser[]> {
		return await this.readUsers();
	}

	/**
	 * Create new user
	 */
	async create(userData: CreateUserData): Promise<AdminUser> {
		const { saltRounds } = getConfig();
		const users = await this.readUsers();

		// Check if user already exists
		const exists = users.some((u: AdminUser) =>
			u.handle === userData.handle || u.username === userData.handle
		);

		if (exists) {
			throw new Error(`User with handle '${userData.handle}' already exists`);
		}

		// Hash password
		const passwordHash = await bcrypt.hash(userData.password, saltRounds);

		// Create new user
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

	/**
	 * Update user
	 */
	async update(id: string, updates: Partial<AdminUser>): Promise<AdminUser> {
		const users = await this.readUsers();
		const index = users.findIndex((u: AdminUser) => u.id === id);

		if (index === -1) {
			throw new Error(`User with id '${id}' not found`);
		}

		// Merge updates
		users[index] = {
			...users[index],
			...updates,
			updatedAt: new Date().toISOString(),
		};

		await this.writeUsers(users);

		return users[index];
	}

	/**
	 * Delete user (soft delete by setting isActive to false)
	 */
	async delete(id: string): Promise<void> {
		await this.update(id, { isActive: false });
	}

	/**
	 * Verify user password
	 */
	async verifyPassword(handle: string, password: string): Promise<AdminUser | null> {
		const user = await this.findByHandle(handle);

		if (!user || !user.passwordHash) {
			return null;
		}

		const isValid = await bcrypt.compare(password, user.passwordHash);
		return isValid ? user : null;
	}

	/**
	 * Update user password
	 */
	async updatePassword(id: string, newPassword: string): Promise<void> {
		const { saltRounds } = getConfig();
		const passwordHash = await bcrypt.hash(newPassword, saltRounds);
		await this.update(id, { passwordHash });
	}

	/**
	 * Enable TOTP for user
	 */
	async enableTotp(id: string, secretId: string): Promise<void> {
		await this.update(id, {
			totpEnabled: true,
			totpSecretId: secretId,
		});
	}

	/**
	 * Disable TOTP for user
	 */
	async disableTotp(id: string): Promise<void> {
		await this.update(id, {
			totpEnabled: false,
			totpSecretId: null,
		});
	}

	/**
	 * Check if any users exist
	 */
	async hasAnyUsers(): Promise<boolean> {
		const users = await this.readUsers();
		return users.length > 0;
	}

	/**
	 * Update last login timestamp
	 */
	async updateLastLogin(id: string): Promise<void> {
		await this.update(id, {
			lastLoginAt: new Date().toISOString(),
		});
	}

	/**
	 * Check if user needs first login setup (legacy support)
	 */
	async needsFirstLoginSetup(id: string): Promise<boolean> {
		const user = await this.findById(id);
		if (!user) return false;

		return user.firstLogin === true;
	}

	/**
	 * Clear cache (useful for testing)
	 */
	clearCache(): void {
		this.cache.clear();
	}
}

/** Singleton instance for convenience */
export const adminUserRepository = new AdminUserRepository();
