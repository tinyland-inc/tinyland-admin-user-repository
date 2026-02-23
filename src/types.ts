












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
	
	[key: string]: unknown;
}




export interface CreateUserData {
	handle: string;
	password: string;
	role?: string;
	email?: string;
	totpEnabled?: boolean;
	totpSecretId?: string;
}
