/**
 * Configuration injection for tinyland-admin-user-repository
 *
 * Provides a way to inject external dependencies (file path, cache TTL,
 * bcrypt salt rounds, file permissions) without coupling to specific
 * implementations.
 *
 * All config values are optional - sensible defaults are used when
 * no configuration is provided.
 *
 * @module config
 *
 * @example
 * ```typescript
 * import { configure } from '@tinyland-inc/tinyland-admin-user-repository';
 *
 * configure({
 *   usersFilePath: '/app/content/auth/admin-users.json',
 *   cacheTtl: 10000,
 *   saltRounds: 12,
 * });
 * ```
 */

/**
 * Configuration options for AdminUserRepository.
 */
export interface AdminUserRepositoryConfig {
	/** Path to the admin users JSON file */
	usersFilePath?: string;
	/** Cache TTL in milliseconds (default: 5000) */
	cacheTtl?: number;
	/** bcrypt salt rounds (default: 10) */
	saltRounds?: number;
	/** Set file permissions after write (default: 0o666) */
	filePermissions?: number;
}

let config: AdminUserRepositoryConfig = {};

/**
 * Configure the admin user repository with external dependencies.
 *
 * Call this once at application startup before using the repository.
 * Merges with existing configuration (does not replace).
 *
 * @param c - Configuration options to merge
 */
export function configure(c: AdminUserRepositoryConfig): void {
	config = { ...config, ...c };
}

/**
 * Get current configuration with defaults applied.
 *
 * @returns Current merged configuration with defaults
 */
export function getConfig(): Required<AdminUserRepositoryConfig> {
	return {
		usersFilePath: config.usersFilePath ?? process.cwd() + '/content/auth/admin-users.json',
		cacheTtl: config.cacheTtl ?? 5000,
		saltRounds: config.saltRounds ?? 10,
		filePermissions: config.filePermissions ?? 0o666,
	};
}

/**
 * Reset all configuration to empty defaults.
 * Primarily useful for testing.
 */
export function resetConfig(): void {
	config = {};
}
