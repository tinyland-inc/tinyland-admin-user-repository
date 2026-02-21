/**
 * @tummycrypt/tinyland-admin-user-repository
 *
 * Admin user repository with flat-file JSON storage and bcrypt password hashing.
 * Framework-agnostic: all external dependencies are injected via configuration.
 *
 * Usage:
 * ```typescript
 * import {
 *   configure,
 *   AdminUserRepository,
 *   adminUserRepository,
 * } from '@tummycrypt/tinyland-admin-user-repository';
 *
 * // Configure once at startup
 * configure({
 *   usersFilePath: '/app/content/auth/admin-users.json',
 *   cacheTtl: 10000,
 * });
 *
 * // Use singleton
 * const user = await adminUserRepository.findByHandle('admin');
 *
 * // Or create your own instance
 * const repo = new AdminUserRepository();
 * const allUsers = await repo.findAll();
 * ```
 *
 * @module @tummycrypt/tinyland-admin-user-repository
 */

// Configuration
export {
	configure,
	getConfig,
	resetConfig,
} from './config.js';

export type {
	AdminUserRepositoryConfig,
} from './config.js';

// Types
export type {
	AdminUser,
	CreateUserData,
} from './types.js';

// Repository
export {
	AdminUserRepository,
	adminUserRepository,
} from './repository.js';
