/**
 * Types for tinyland-admin-user-repository
 *
 * Minimal AdminUser interface containing only the fields the repository
 * actually reads and writes. The index signature allows pass-through of
 * additional application-specific fields.
 *
 * @module types
 */

/**
 * Admin user record stored in the flat-file JSON database.
 */
export interface AdminUser {
	id: string;
	username: string;
	handle?: string;
	passwordHash?: string;
	role: string;
	isActive?: boolean;
	createdAt?: string;
	updatedAt?: string;
	lastLoginAt?: string | null;
	permissions?: string[];
	totpEnabled?: boolean;
	totpSecretId?: string | null;
	needsOnboarding?: boolean;
	onboardingStep?: number;
	firstLogin?: boolean;
	/** Allow additional application-specific fields */
	[key: string]: unknown;
}

/**
 * Data required to create a new admin user.
 */
export interface CreateUserData {
	handle: string;
	password: string;
	role?: string;
	email?: string;
	totpEnabled?: boolean;
	totpSecretId?: string;
}
