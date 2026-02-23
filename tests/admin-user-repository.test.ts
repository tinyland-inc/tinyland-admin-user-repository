import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { promises as fs } from 'fs';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
	configure,
	getConfig,
	resetConfig,
	AdminUserRepository,
	adminUserRepository,
} from '../src/index.js';
import type { AdminUser, AdminUserRepositoryConfig } from '../src/index.js';





vi.mock('fs', () => ({
	promises: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
		chmod: vi.fn(),
	},
}));

vi.mock('bcryptjs', () => ({
	hash: vi.fn((password: string, _rounds: number) =>
		Promise.resolve('$2a$10$hashed_' + password)
	),
	compare: vi.fn((password: string, hash: string) =>
		Promise.resolve(hash.endsWith(password))
	),
}));

let uuidCounter = 0;
vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
	uuidCounter++;
	return `test-uuid-${uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`;
});

const mockReadFile = vi.mocked(fs.readFile);
const mockWriteFile = vi.mocked(fs.writeFile);
const mockChmod = vi.mocked(fs.chmod);
const mockHash = vi.mocked(bcrypt.hash);
const mockCompare = vi.mocked(bcrypt.compare);





function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
	return {
		id: 'user-1',
		username: 'testuser',
		handle: 'testuser',
		passwordHash: '$2a$10$hashed_password123',
		role: 'admin',
		isActive: true,
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		lastLoginAt: null,
		permissions: [],
		totpEnabled: false,
		totpSecretId: null,
		needsOnboarding: false,
		onboardingStep: 0,
		firstLogin: false,
		...overrides,
	};
}

function setFileContent(users: AdminUser[]): void {
	mockReadFile.mockResolvedValue(JSON.stringify(users));
}

function setFileContentObject(data: Record<string, unknown>): void {
	mockReadFile.mockResolvedValue(JSON.stringify(data));
}

function setFileNotFound(): void {
	const error = new Error('ENOENT') as NodeJS.ErrnoException;
	error.code = 'ENOENT';
	mockReadFile.mockRejectedValue(error);
}

function setWriteSuccess(): void {
	mockWriteFile.mockResolvedValue(undefined);
	mockChmod.mockResolvedValue(undefined);
}





beforeEach(() => {
	vi.clearAllMocks();
	resetConfig();
	uuidCounter = 0;
	setWriteSuccess();
});





describe('Config DI', () => {
	it('should return default usersFilePath when unconfigured', () => {
		const cfg = getConfig();
		expect(cfg.usersFilePath).toContain('/content/auth/admin-users.json');
	});

	it('should return default cacheTtl of 5000 when unconfigured', () => {
		expect(getConfig().cacheTtl).toBe(5000);
	});

	it('should return default saltRounds of 10 when unconfigured', () => {
		expect(getConfig().saltRounds).toBe(10);
	});

	it('should return default filePermissions of 0o666 when unconfigured', () => {
		expect(getConfig().filePermissions).toBe(0o666);
	});

	it('should merge custom usersFilePath', () => {
		configure({ usersFilePath: '/custom/path.json' });
		expect(getConfig().usersFilePath).toBe('/custom/path.json');
	});

	it('should merge custom cacheTtl', () => {
		configure({ cacheTtl: 10000 });
		expect(getConfig().cacheTtl).toBe(10000);
	});

	it('should merge custom saltRounds', () => {
		configure({ saltRounds: 12 });
		expect(getConfig().saltRounds).toBe(12);
	});

	it('should merge custom filePermissions', () => {
		configure({ filePermissions: 0o644 });
		expect(getConfig().filePermissions).toBe(0o644);
	});

	it('should merge partial config without overwriting other fields', () => {
		configure({ usersFilePath: '/first' });
		configure({ cacheTtl: 9999 });
		const cfg = getConfig();
		expect(cfg.usersFilePath).toBe('/first');
		expect(cfg.cacheTtl).toBe(9999);
	});

	it('should reset all config to defaults', () => {
		configure({ usersFilePath: '/custom', cacheTtl: 1, saltRounds: 1, filePermissions: 0o777 });
		resetConfig();
		const cfg = getConfig();
		expect(cfg.usersFilePath).toContain('/content/auth/admin-users.json');
		expect(cfg.cacheTtl).toBe(5000);
		expect(cfg.saltRounds).toBe(10);
		expect(cfg.filePermissions).toBe(0o666);
	});

	it('should accept empty config without error', () => {
		expect(() => configure({})).not.toThrow();
	});
});





describe('readUsers / writeUsers (via public methods)', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should read users from JSON array format', async () => {
		const users = [makeUser()];
		setFileContent(users);
		const result = await repo.findAll();
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('user-1');
	});

	it('should read users from JSON object with users property', async () => {
		setFileContentObject({ users: [makeUser()] });
		const result = await repo.findAll();
		expect(result).toHaveLength(1);
	});

	it('should return empty array when object format has no users property', async () => {
		setFileContentObject({ other: 'data' });
		const result = await repo.findAll();
		expect(result).toHaveLength(0);
	});

	it('should return empty array when file does not exist (ENOENT)', async () => {
		setFileNotFound();
		const result = await repo.findAll();
		expect(result).toHaveLength(0);
	});

	it('should throw on non-ENOENT read errors', async () => {
		const error = new Error('Permission denied') as NodeJS.ErrnoException;
		error.code = 'EACCES';
		mockReadFile.mockRejectedValue(error);
		await expect(repo.findAll()).rejects.toThrow('Permission denied');
	});

	it('should write users as JSON to configured path', async () => {
		configure({ usersFilePath: '/test/users.json' });
		setFileContent([]);
		await repo.create({ handle: 'newuser', password: 'pass123' });
		expect(mockWriteFile).toHaveBeenCalledWith(
			'/test/users.json',
			expect.any(String),
			'utf8'
		);
	});

	it('should write JSON with 2-space indentation', async () => {
		setFileContent([]);
		await repo.create({ handle: 'newuser', password: 'pass123' });
		const written = mockWriteFile.mock.calls[0][1] as string;
		expect(written).toContain('  ');
	});

	it('should chmod file after write with configured permissions', async () => {
		configure({ usersFilePath: '/test/users.json', filePermissions: 0o644 });
		setFileContent([]);
		await repo.create({ handle: 'newuser', password: 'pass123' });
		expect(mockChmod).toHaveBeenCalledWith('/test/users.json', 0o644);
	});

	it('should use default 0o666 permissions on chmod', async () => {
		configure({ usersFilePath: '/test/users.json' });
		setFileContent([]);
		await repo.create({ handle: 'newuser', password: 'pass123' });
		expect(mockChmod).toHaveBeenCalledWith('/test/users.json', 0o666);
	});

	it('should not throw when chmod fails', async () => {
		mockChmod.mockRejectedValue(new Error('chmod not supported'));
		setFileContent([]);
		await expect(repo.create({ handle: 'newuser', password: 'pass123' })).resolves.toBeDefined();
	});

	it('should clear cache after write', async () => {
		const user = makeUser();
		setFileContent([user]);

		
		await repo.findByHandle('testuser');
		expect(await repo.findByHandle('testuser')).toBeTruthy();

		
		await repo.update('user-1', { role: 'moderator' });
		
		
		expect(mockReadFile).toHaveBeenCalledTimes(2);
	});

	it('should handle empty array in file', async () => {
		setFileContent([]);
		const result = await repo.findAll();
		expect(result).toHaveLength(0);
	});
});





describe('findByHandle', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should find user by handle field', async () => {
		setFileContent([makeUser({ handle: 'alice' })]);
		const user = await repo.findByHandle('alice');
		expect(user).toBeTruthy();
		expect(user!.handle).toBe('alice');
	});

	it('should find user by username field when handle differs', async () => {
		setFileContent([makeUser({ username: 'bob', handle: undefined })]);
		const user = await repo.findByHandle('bob');
		expect(user).toBeTruthy();
		expect(user!.username).toBe('bob');
	});

	it('should return null when no user matches', async () => {
		setFileContent([makeUser({ handle: 'alice' })]);
		const user = await repo.findByHandle('unknown');
		expect(user).toBeNull();
	});

	it('should exclude inactive users', async () => {
		setFileContent([makeUser({ handle: 'alice', isActive: false })]);
		const user = await repo.findByHandle('alice');
		expect(user).toBeNull();
	});

	it('should include users with isActive undefined (default active)', async () => {
		const user = makeUser({ handle: 'alice' });
		delete (user as Record<string, unknown>).isActive;
		setFileContent([user]);
		const result = await repo.findByHandle('alice');
		expect(result).toBeTruthy();
	});

	it('should cache result after first lookup', async () => {
		setFileContent([makeUser({ handle: 'alice' })]);
		await repo.findByHandle('alice');
		await repo.findByHandle('alice');
		
		expect(mockReadFile).toHaveBeenCalledTimes(1);
	});

	it('should return cached result on second call', async () => {
		setFileContent([makeUser({ handle: 'alice' })]);
		const first = await repo.findByHandle('alice');
		const second = await repo.findByHandle('alice');
		expect(first).toEqual(second);
	});

	it('should bypass cache after TTL expires', async () => {
		configure({ cacheTtl: 0 }); 
		setFileContent([makeUser({ handle: 'alice' })]);
		await repo.findByHandle('alice');
		
		await repo.findByHandle('alice');
		expect(mockReadFile).toHaveBeenCalledTimes(2);
	});

	it('should not cache when user is not found', async () => {
		setFileContent([]);
		await repo.findByHandle('ghost');
		await repo.findByHandle('ghost');
		expect(mockReadFile).toHaveBeenCalledTimes(2);
	});

	it('should return null when file does not exist', async () => {
		setFileNotFound();
		const user = await repo.findByHandle('anyone');
		expect(user).toBeNull();
	});

	it('should match handle case-sensitively', async () => {
		setFileContent([makeUser({ handle: 'Alice' })]);
		const user = await repo.findByHandle('alice');
		expect(user).toBeNull();
	});

	it('should find first matching user when multiple share username', async () => {
		setFileContent([
			makeUser({ id: 'u1', handle: 'shared', username: 'shared' }),
			makeUser({ id: 'u2', handle: 'shared', username: 'shared' }),
		]);
		const user = await repo.findByHandle('shared');
		expect(user!.id).toBe('u1');
	});
});





describe('findById', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should find user by id', async () => {
		setFileContent([makeUser({ id: 'abc-123' })]);
		const user = await repo.findById('abc-123');
		expect(user).toBeTruthy();
		expect(user!.id).toBe('abc-123');
	});

	it('should return null when id not found', async () => {
		setFileContent([makeUser({ id: 'abc-123' })]);
		const user = await repo.findById('nonexistent');
		expect(user).toBeNull();
	});

	it('should include inactive users (findById does not filter by isActive)', async () => {
		setFileContent([makeUser({ id: 'abc-123', isActive: false })]);
		const user = await repo.findById('abc-123');
		expect(user).toBeTruthy();
	});

	it('should cache result after first lookup', async () => {
		setFileContent([makeUser({ id: 'abc-123' })]);
		await repo.findById('abc-123');
		await repo.findById('abc-123');
		expect(mockReadFile).toHaveBeenCalledTimes(1);
	});

	it('should return cached result on second call', async () => {
		setFileContent([makeUser({ id: 'abc-123' })]);
		const first = await repo.findById('abc-123');
		const second = await repo.findById('abc-123');
		expect(first).toEqual(second);
	});

	it('should bypass cache after TTL expires', async () => {
		configure({ cacheTtl: 0 });
		setFileContent([makeUser({ id: 'abc-123' })]);
		await repo.findById('abc-123');
		await repo.findById('abc-123');
		expect(mockReadFile).toHaveBeenCalledTimes(2);
	});

	it('should not cache when user is not found', async () => {
		setFileContent([]);
		await repo.findById('ghost');
		await repo.findById('ghost');
		expect(mockReadFile).toHaveBeenCalledTimes(2);
	});

	it('should return null when file does not exist', async () => {
		setFileNotFound();
		const user = await repo.findById('any');
		expect(user).toBeNull();
	});

	it('should return correct user among multiple', async () => {
		setFileContent([
			makeUser({ id: 'u1', username: 'alice' }),
			makeUser({ id: 'u2', username: 'bob' }),
			makeUser({ id: 'u3', username: 'carol' }),
		]);
		const user = await repo.findById('u2');
		expect(user!.username).toBe('bob');
	});

	it('should use separate cache keys from findByHandle', async () => {
		setFileContent([makeUser({ id: 'u1', handle: 'alice' })]);
		await repo.findByHandle('alice');
		
		await repo.findById('u1');
		expect(mockReadFile).toHaveBeenCalledTimes(2);
	});
});





describe('findByEmail', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should find user by username matching email (legacy)', async () => {
		setFileContent([makeUser({ username: 'admin@example.com' })]);
		const user = await repo.findByEmail('admin@example.com');
		expect(user).toBeTruthy();
	});

	it('should return null when no username matches email', async () => {
		setFileContent([makeUser({ username: 'other' })]);
		const user = await repo.findByEmail('admin@example.com');
		expect(user).toBeNull();
	});

	it('should exclude inactive users', async () => {
		setFileContent([makeUser({ username: 'admin@example.com', isActive: false })]);
		const user = await repo.findByEmail('admin@example.com');
		expect(user).toBeNull();
	});

	it('should include users with isActive undefined', async () => {
		const user = makeUser({ username: 'admin@example.com' });
		delete (user as Record<string, unknown>).isActive;
		setFileContent([user]);
		const result = await repo.findByEmail('admin@example.com');
		expect(result).toBeTruthy();
	});

	it('should return null when file does not exist', async () => {
		setFileNotFound();
		const user = await repo.findByEmail('nobody@test.com');
		expect(user).toBeNull();
	});

	it('should match case-sensitively', async () => {
		setFileContent([makeUser({ username: 'Admin@Example.com' })]);
		const user = await repo.findByEmail('admin@example.com');
		expect(user).toBeNull();
	});

	it('should not use cache (always reads from file)', async () => {
		setFileContent([makeUser({ username: 'admin@example.com' })]);
		await repo.findByEmail('admin@example.com');
		await repo.findByEmail('admin@example.com');
		expect(mockReadFile).toHaveBeenCalledTimes(2);
	});

	it('should return first matching user', async () => {
		setFileContent([
			makeUser({ id: 'u1', username: 'admin@example.com' }),
			makeUser({ id: 'u2', username: 'admin@example.com' }),
		]);
		const user = await repo.findByEmail('admin@example.com');
		expect(user!.id).toBe('u1');
	});
});





describe('findAll', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should return all users including inactive', async () => {
		setFileContent([
			makeUser({ id: 'u1', isActive: true }),
			makeUser({ id: 'u2', isActive: false }),
		]);
		const users = await repo.findAll();
		expect(users).toHaveLength(2);
	});

	it('should return empty array when no users exist', async () => {
		setFileContent([]);
		const users = await repo.findAll();
		expect(users).toHaveLength(0);
	});

	it('should return empty array when file does not exist', async () => {
		setFileNotFound();
		const users = await repo.findAll();
		expect(users).toHaveLength(0);
	});

	it('should return users from object format', async () => {
		setFileContentObject({ users: [makeUser(), makeUser({ id: 'u2' })] });
		const users = await repo.findAll();
		expect(users).toHaveLength(2);
	});

	it('should read from file each time (no cache for findAll)', async () => {
		setFileContent([makeUser()]);
		await repo.findAll();
		await repo.findAll();
		expect(mockReadFile).toHaveBeenCalledTimes(2);
	});
});





describe('create', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should create a new user and return it', async () => {
		setFileContent([]);
		const user = await repo.create({ handle: 'newadmin', password: 'secret123' });
		expect(user).toBeTruthy();
		expect(user.handle).toBe('newadmin');
	});

	it('should set username same as handle', async () => {
		setFileContent([]);
		const user = await repo.create({ handle: 'newadmin', password: 'secret123' });
		expect(user.username).toBe('newadmin');
	});

	it('should hash password using bcrypt', async () => {
		setFileContent([]);
		await repo.create({ handle: 'newadmin', password: 'secret123' });
		expect(mockHash).toHaveBeenCalledWith('secret123', 10);
	});

	it('should use configured saltRounds for hashing', async () => {
		configure({ saltRounds: 14 });
		setFileContent([]);
		await repo.create({ handle: 'newadmin', password: 'secret123' });
		expect(mockHash).toHaveBeenCalledWith('secret123', 14);
	});

	it('should store hashed password, not plain text', async () => {
		setFileContent([]);
		const user = await repo.create({ handle: 'newadmin', password: 'secret123' });
		expect(user.passwordHash).toBe('$2a$10$hashed_secret123');
		expect(user.passwordHash).not.toBe('secret123');
	});

	it('should generate UUID for new user id', async () => {
		setFileContent([]);
		const user = await repo.create({ handle: 'newadmin', password: 'secret123' });
		expect(user.id).toBe('test-uuid-1');
	});

	it('should increment UUID counter for multiple creates', async () => {
		setFileContent([]);
		const user1 = await repo.create({ handle: 'admin1', password: 'pass1' });
		
		setFileContent([user1]);
		const user2 = await repo.create({ handle: 'admin2', password: 'pass2' });
		expect(user1.id).toBe('test-uuid-1');
		expect(user2.id).toBe('test-uuid-2');
	});

	it('should throw when handle already exists (by handle)', async () => {
		setFileContent([makeUser({ handle: 'existing' })]);
		await expect(repo.create({ handle: 'existing', password: 'pass' }))
			.rejects.toThrow("User with handle 'existing' already exists");
	});

	it('should throw when handle already exists (by username)', async () => {
		setFileContent([makeUser({ username: 'existing', handle: undefined })]);
		await expect(repo.create({ handle: 'existing', password: 'pass' }))
			.rejects.toThrow("User with handle 'existing' already exists");
	});

	it('should set default role to admin', async () => {
		setFileContent([]);
		const user = await repo.create({ handle: 'newadmin', password: 'pass' });
		expect(user.role).toBe('admin');
	});

	it('should allow custom role', async () => {
		setFileContent([]);
		const user = await repo.create({ handle: 'newmod', password: 'pass', role: 'moderator' });
		expect(user.role).toBe('moderator');
	});

	it('should set isActive to true by default', async () => {
		setFileContent([]);
		const user = await repo.create({ handle: 'newadmin', password: 'pass' });
		expect(user.isActive).toBe(true);
	});

	it('should set timestamps on creation', async () => {
		setFileContent([]);
		const user = await repo.create({ handle: 'newadmin', password: 'pass' });
		expect(user.createdAt).toBeDefined();
		expect(user.updatedAt).toBeDefined();
	});

	it('should write users to file after create', async () => {
		setFileContent([]);
		await repo.create({ handle: 'newadmin', password: 'pass' });
		expect(mockWriteFile).toHaveBeenCalledTimes(1);
	});

	it('should store totpEnabled and totpSecretId when provided', async () => {
		setFileContent([]);
		const user = await repo.create({
			handle: 'newadmin',
			password: 'pass',
			totpEnabled: true,
			totpSecretId: 'secret-id-123',
		});
		expect(user.totpEnabled).toBe(true);
		expect(user.totpSecretId).toBe('secret-id-123');
	});
});





describe('update', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should merge updates into existing user', async () => {
		setFileContent([makeUser({ id: 'u1', role: 'admin' })]);
		const updated = await repo.update('u1', { role: 'moderator' });
		expect(updated.role).toBe('moderator');
	});

	it('should preserve fields not in updates', async () => {
		setFileContent([makeUser({ id: 'u1', username: 'alice', handle: 'alice' })]);
		const updated = await repo.update('u1', { role: 'viewer' });
		expect(updated.username).toBe('alice');
		expect(updated.handle).toBe('alice');
	});

	it('should set updatedAt timestamp', async () => {
		const original = makeUser({ id: 'u1', updatedAt: '2020-01-01T00:00:00.000Z' });
		setFileContent([original]);
		const updated = await repo.update('u1', { role: 'viewer' });
		expect(updated.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
	});

	it('should throw when user id not found', async () => {
		setFileContent([makeUser({ id: 'u1' })]);
		await expect(repo.update('nonexistent', { role: 'admin' }))
			.rejects.toThrow("User with id 'nonexistent' not found");
	});

	it('should throw on empty user list', async () => {
		setFileContent([]);
		await expect(repo.update('any', { role: 'admin' }))
			.rejects.toThrow("User with id 'any' not found");
	});

	it('should write updated users to file', async () => {
		setFileContent([makeUser({ id: 'u1' })]);
		await repo.update('u1', { role: 'viewer' });
		expect(mockWriteFile).toHaveBeenCalledTimes(1);
	});

	it('should clear cache after update', async () => {
		setFileContent([makeUser({ id: 'u1', handle: 'alice' })]);
		await repo.findByHandle('alice'); 
		await repo.update('u1', { role: 'viewer' }); 

		
		setFileContent([makeUser({ id: 'u1', handle: 'alice', role: 'viewer' })]);
		const user = await repo.findByHandle('alice');
		expect(user!.role).toBe('viewer');
	});

	it('should update multiple fields at once', async () => {
		setFileContent([makeUser({ id: 'u1' })]);
		const updated = await repo.update('u1', {
			role: 'editor',
			permissions: ['read', 'write'],
			needsOnboarding: true,
		});
		expect(updated.role).toBe('editor');
		expect(updated.permissions).toEqual(['read', 'write']);
		expect(updated.needsOnboarding).toBe(true);
	});

	it('should return the full updated user object', async () => {
		setFileContent([makeUser({ id: 'u1', username: 'alice' })]);
		const updated = await repo.update('u1', { role: 'viewer' });
		expect(updated.id).toBe('u1');
		expect(updated.username).toBe('alice');
		expect(updated.role).toBe('viewer');
	});

	it('should handle updating isActive field', async () => {
		setFileContent([makeUser({ id: 'u1', isActive: true })]);
		const updated = await repo.update('u1', { isActive: false });
		expect(updated.isActive).toBe(false);
	});

	it('should update correct user when multiple exist', async () => {
		setFileContent([
			makeUser({ id: 'u1', username: 'alice' }),
			makeUser({ id: 'u2', username: 'bob' }),
		]);
		const updated = await repo.update('u2', { role: 'editor' });
		expect(updated.id).toBe('u2');
		expect(updated.role).toBe('editor');
	});

	it('should write all users back (not just updated one)', async () => {
		setFileContent([
			makeUser({ id: 'u1', username: 'alice' }),
			makeUser({ id: 'u2', username: 'bob' }),
		]);
		await repo.update('u2', { role: 'editor' });
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written).toHaveLength(2);
		expect(written[0].username).toBe('alice');
		expect(written[1].role).toBe('editor');
	});
});





describe('delete', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should soft delete by setting isActive to false', async () => {
		setFileContent([makeUser({ id: 'u1', isActive: true })]);
		await repo.delete('u1');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].isActive).toBe(false);
	});

	it('should not remove user from file (soft delete)', async () => {
		setFileContent([makeUser({ id: 'u1' })]);
		await repo.delete('u1');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written).toHaveLength(1);
	});

	it('should not be findable by handle after soft delete', async () => {
		const user = makeUser({ id: 'u1', handle: 'alice' });
		setFileContent([user]);
		await repo.delete('u1');

		
		setFileContent([{ ...user, isActive: false }]);
		const result = await repo.findByHandle('alice');
		expect(result).toBeNull();
	});

	it('should throw when user id not found', async () => {
		setFileContent([]);
		await expect(repo.delete('nonexistent'))
			.rejects.toThrow("User with id 'nonexistent' not found");
	});

	it('should set updatedAt on delete', async () => {
		setFileContent([makeUser({ id: 'u1', updatedAt: '2020-01-01' })]);
		await repo.delete('u1');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].updatedAt).not.toBe('2020-01-01');
	});

	it('should still be findable by id after soft delete', async () => {
		const user = makeUser({ id: 'u1', isActive: true });
		setFileContent([user]);
		await repo.delete('u1');

		setFileContent([{ ...user, isActive: false }]);
		const result = await repo.findById('u1');
		expect(result).toBeTruthy();
		expect(result!.isActive).toBe(false);
	});

	it('should only soft delete the specified user', async () => {
		setFileContent([
			makeUser({ id: 'u1', isActive: true }),
			makeUser({ id: 'u2', isActive: true }),
		]);
		await repo.delete('u1');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].isActive).toBe(false);
		expect(written[1].isActive).toBe(true);
	});

	it('should work on already inactive user (idempotent)', async () => {
		setFileContent([makeUser({ id: 'u1', isActive: false })]);
		await expect(repo.delete('u1')).resolves.toBeUndefined();
	});
});





describe('verifyPassword', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should return user when password matches', async () => {
		setFileContent([makeUser({ handle: 'alice', passwordHash: '$2a$10$hashed_correctpass' })]);
		const user = await repo.verifyPassword('alice', 'correctpass');
		expect(user).toBeTruthy();
		expect(user!.handle).toBe('alice');
	});

	it('should return null when password does not match', async () => {
		setFileContent([makeUser({ handle: 'alice', passwordHash: '$2a$10$hashed_correctpass' })]);
		const user = await repo.verifyPassword('alice', 'wrongpass');
		expect(user).toBeNull();
	});

	it('should return null when user not found', async () => {
		setFileContent([]);
		const user = await repo.verifyPassword('nonexistent', 'anypass');
		expect(user).toBeNull();
	});

	it('should return null when user has no passwordHash', async () => {
		setFileContent([makeUser({ handle: 'alice', passwordHash: undefined })]);
		const user = await repo.verifyPassword('alice', 'anypass');
		expect(user).toBeNull();
	});

	it('should return null when user has empty passwordHash', async () => {
		setFileContent([makeUser({ handle: 'alice', passwordHash: '' })]);
		const user = await repo.verifyPassword('alice', 'anypass');
		expect(user).toBeNull();
	});

	it('should call bcrypt.compare with correct arguments', async () => {
		setFileContent([makeUser({ handle: 'alice', passwordHash: '$2a$10$somehash' })]);
		await repo.verifyPassword('alice', 'mypassword');
		expect(mockCompare).toHaveBeenCalledWith('mypassword', '$2a$10$somehash');
	});

	it('should return null for inactive user (findByHandle excludes inactive)', async () => {
		setFileContent([makeUser({ handle: 'alice', isActive: false, passwordHash: '$2a$10$hashed_pass' })]);
		const user = await repo.verifyPassword('alice', 'pass');
		expect(user).toBeNull();
	});

	it('should find user by username for password verification', async () => {
		setFileContent([makeUser({ username: 'alice', handle: undefined, passwordHash: '$2a$10$hashed_pass' })]);
		const user = await repo.verifyPassword('alice', 'pass');
		expect(user).toBeTruthy();
	});

	it('should return the full user object on success', async () => {
		const fullUser = makeUser({
			handle: 'alice',
			passwordHash: '$2a$10$hashed_pass',
			role: 'admin',
			permissions: ['read', 'write'],
		});
		setFileContent([fullUser]);
		const user = await repo.verifyPassword('alice', 'pass');
		expect(user!.role).toBe('admin');
		expect(user!.permissions).toEqual(['read', 'write']);
	});

	it('should not expose any raw password in returned user', async () => {
		setFileContent([makeUser({ handle: 'alice', passwordHash: '$2a$10$hashed_pass' })]);
		const user = await repo.verifyPassword('alice', 'pass');
		expect(user).toBeTruthy();
		
		expect((user as Record<string, unknown>).password).toBeUndefined();
	});

	it('should handle bcrypt.compare returning false', async () => {
		mockCompare.mockResolvedValueOnce(false);
		setFileContent([makeUser({ handle: 'alice', passwordHash: '$2a$10$anything' })]);
		const user = await repo.verifyPassword('alice', 'wrong');
		expect(user).toBeNull();
	});

	it('should handle bcrypt.compare returning true', async () => {
		mockCompare.mockResolvedValueOnce(true);
		setFileContent([makeUser({ handle: 'alice', passwordHash: '$2a$10$anything' })]);
		const user = await repo.verifyPassword('alice', 'correct');
		expect(user).toBeTruthy();
	});
});





describe('updatePassword', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should hash new password using bcrypt', async () => {
		setFileContent([makeUser({ id: 'u1' })]);
		await repo.updatePassword('u1', 'newpassword123');
		expect(mockHash).toHaveBeenCalledWith('newpassword123', 10);
	});

	it('should use configured saltRounds for hashing', async () => {
		configure({ saltRounds: 14 });
		setFileContent([makeUser({ id: 'u1' })]);
		await repo.updatePassword('u1', 'newpassword123');
		expect(mockHash).toHaveBeenCalledWith('newpassword123', 14);
	});

	it('should store hashed password in user record', async () => {
		setFileContent([makeUser({ id: 'u1' })]);
		await repo.updatePassword('u1', 'newpassword123');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].passwordHash).toBe('$2a$10$hashed_newpassword123');
	});

	it('should throw when user id not found', async () => {
		setFileContent([]);
		await expect(repo.updatePassword('nonexistent', 'pass'))
			.rejects.toThrow("User with id 'nonexistent' not found");
	});

	it('should update updatedAt timestamp', async () => {
		setFileContent([makeUser({ id: 'u1', updatedAt: '2020-01-01' })]);
		await repo.updatePassword('u1', 'newpass');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].updatedAt).not.toBe('2020-01-01');
	});

	it('should verify new password works after update', async () => {
		setFileContent([makeUser({ id: 'u1', handle: 'alice' })]);
		await repo.updatePassword('u1', 'newpassword');

		
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		setFileContent(written);

		const user = await repo.verifyPassword('alice', 'newpassword');
		expect(user).toBeTruthy();
	});

	it('should preserve other user fields', async () => {
		setFileContent([makeUser({ id: 'u1', role: 'admin', permissions: ['read'] })]);
		await repo.updatePassword('u1', 'newpass');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].role).toBe('admin');
		expect(written[0].permissions).toEqual(['read']);
	});

	it('should clear cache after password update', async () => {
		setFileContent([makeUser({ id: 'u1', handle: 'alice' })]);
		await repo.findByHandle('alice'); 
		await repo.updatePassword('u1', 'newpass'); 
		
		setFileContent([makeUser({ id: 'u1', handle: 'alice', passwordHash: '$2a$10$hashed_newpass' })]);
		await repo.findByHandle('alice'); 
		expect(mockReadFile).toHaveBeenCalledTimes(3);
	});
});





describe('TOTP', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should enable TOTP with secretId', async () => {
		setFileContent([makeUser({ id: 'u1', totpEnabled: false, totpSecretId: null })]);
		await repo.enableTotp('u1', 'secret-abc');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].totpEnabled).toBe(true);
		expect(written[0].totpSecretId).toBe('secret-abc');
	});

	it('should disable TOTP and clear secretId', async () => {
		setFileContent([makeUser({ id: 'u1', totpEnabled: true, totpSecretId: 'secret-abc' })]);
		await repo.disableTotp('u1');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].totpEnabled).toBe(false);
		expect(written[0].totpSecretId).toBeNull();
	});

	it('should throw when enabling TOTP for nonexistent user', async () => {
		setFileContent([]);
		await expect(repo.enableTotp('nonexistent', 'secret'))
			.rejects.toThrow("User with id 'nonexistent' not found");
	});

	it('should throw when disabling TOTP for nonexistent user', async () => {
		setFileContent([]);
		await expect(repo.disableTotp('nonexistent'))
			.rejects.toThrow("User with id 'nonexistent' not found");
	});

	it('should preserve other fields when enabling TOTP', async () => {
		setFileContent([makeUser({ id: 'u1', username: 'alice', role: 'admin' })]);
		await repo.enableTotp('u1', 'secret-abc');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].username).toBe('alice');
		expect(written[0].role).toBe('admin');
	});

	it('should preserve other fields when disabling TOTP', async () => {
		setFileContent([makeUser({ id: 'u1', username: 'alice', role: 'admin', totpEnabled: true })]);
		await repo.disableTotp('u1');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].username).toBe('alice');
		expect(written[0].role).toBe('admin');
	});

	it('should set updatedAt when enabling TOTP', async () => {
		setFileContent([makeUser({ id: 'u1', updatedAt: '2020-01-01' })]);
		await repo.enableTotp('u1', 'secret');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].updatedAt).not.toBe('2020-01-01');
	});

	it('should set updatedAt when disabling TOTP', async () => {
		setFileContent([makeUser({ id: 'u1', updatedAt: '2020-01-01' })]);
		await repo.disableTotp('u1');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].updatedAt).not.toBe('2020-01-01');
	});

	it('should be idempotent when enabling already enabled TOTP', async () => {
		setFileContent([makeUser({ id: 'u1', totpEnabled: true, totpSecretId: 'old-secret' })]);
		await expect(repo.enableTotp('u1', 'new-secret')).resolves.toBeUndefined();
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].totpSecretId).toBe('new-secret');
	});

	it('should be idempotent when disabling already disabled TOTP', async () => {
		setFileContent([makeUser({ id: 'u1', totpEnabled: false, totpSecretId: null })]);
		await expect(repo.disableTotp('u1')).resolves.toBeUndefined();
	});
});





describe('hasAnyUsers', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should return true when users exist', async () => {
		setFileContent([makeUser()]);
		expect(await repo.hasAnyUsers()).toBe(true);
	});

	it('should return false when no users exist', async () => {
		setFileContent([]);
		expect(await repo.hasAnyUsers()).toBe(false);
	});

	it('should return false when file does not exist', async () => {
		setFileNotFound();
		expect(await repo.hasAnyUsers()).toBe(false);
	});

	it('should return true even with only inactive users', async () => {
		setFileContent([makeUser({ isActive: false })]);
		expect(await repo.hasAnyUsers()).toBe(true);
	});

	it('should return true with multiple users', async () => {
		setFileContent([makeUser({ id: 'u1' }), makeUser({ id: 'u2' })]);
		expect(await repo.hasAnyUsers()).toBe(true);
	});
});





describe('updateLastLogin', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should set lastLoginAt to current timestamp', async () => {
		setFileContent([makeUser({ id: 'u1', lastLoginAt: null })]);
		await repo.updateLastLogin('u1');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].lastLoginAt).toBeDefined();
		expect(typeof written[0].lastLoginAt).toBe('string');
	});

	it('should update lastLoginAt from previous value', async () => {
		setFileContent([makeUser({ id: 'u1', lastLoginAt: '2020-01-01T00:00:00.000Z' })]);
		await repo.updateLastLogin('u1');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].lastLoginAt).not.toBe('2020-01-01T00:00:00.000Z');
	});

	it('should throw when user id not found', async () => {
		setFileContent([]);
		await expect(repo.updateLastLogin('nonexistent'))
			.rejects.toThrow("User with id 'nonexistent' not found");
	});

	it('should set lastLoginAt as ISO string', async () => {
		setFileContent([makeUser({ id: 'u1' })]);
		await repo.updateLastLogin('u1');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		
		expect(written[0].lastLoginAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('should also update updatedAt', async () => {
		setFileContent([makeUser({ id: 'u1', updatedAt: '2020-01-01' })]);
		await repo.updateLastLogin('u1');
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written[0].updatedAt).not.toBe('2020-01-01');
	});
});





describe('needsFirstLoginSetup', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should return true when firstLogin is true', async () => {
		setFileContent([makeUser({ id: 'u1', firstLogin: true })]);
		expect(await repo.needsFirstLoginSetup('u1')).toBe(true);
	});

	it('should return false when firstLogin is false', async () => {
		setFileContent([makeUser({ id: 'u1', firstLogin: false })]);
		expect(await repo.needsFirstLoginSetup('u1')).toBe(false);
	});

	it('should return false when firstLogin is undefined', async () => {
		const user = makeUser({ id: 'u1' });
		delete (user as Record<string, unknown>).firstLogin;
		setFileContent([user]);
		expect(await repo.needsFirstLoginSetup('u1')).toBe(false);
	});

	it('should return false when user not found', async () => {
		setFileContent([]);
		expect(await repo.needsFirstLoginSetup('nonexistent')).toBe(false);
	});

	it('should return false when file does not exist', async () => {
		setFileNotFound();
		expect(await repo.needsFirstLoginSetup('any')).toBe(false);
	});
});





describe('Cache', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should hit cache on repeated findByHandle calls', async () => {
		setFileContent([makeUser({ handle: 'alice' })]);
		await repo.findByHandle('alice');
		await repo.findByHandle('alice');
		expect(mockReadFile).toHaveBeenCalledTimes(1);
	});

	it('should hit cache on repeated findById calls', async () => {
		setFileContent([makeUser({ id: 'u1' })]);
		await repo.findById('u1');
		await repo.findById('u1');
		expect(mockReadFile).toHaveBeenCalledTimes(1);
	});

	it('should miss cache when different keys are used', async () => {
		setFileContent([makeUser({ id: 'u1', handle: 'alice' })]);
		await repo.findByHandle('alice');
		await repo.findById('u1');
		expect(mockReadFile).toHaveBeenCalledTimes(2);
	});

	it('should clear cache via clearCache()', async () => {
		setFileContent([makeUser({ handle: 'alice' })]);
		await repo.findByHandle('alice');
		repo.clearCache();
		await repo.findByHandle('alice');
		expect(mockReadFile).toHaveBeenCalledTimes(2);
	});

	it('should clear cache after write operations', async () => {
		setFileContent([makeUser({ id: 'u1', handle: 'alice' })]);
		await repo.findByHandle('alice');
		await repo.update('u1', { role: 'viewer' });
		setFileContent([makeUser({ id: 'u1', handle: 'alice', role: 'viewer' })]);
		await repo.findByHandle('alice');
		
		expect(mockReadFile).toHaveBeenCalledTimes(3);
	});

	it('should expire cache entries after TTL', async () => {
		configure({ cacheTtl: 0 }); 
		setFileContent([makeUser({ handle: 'alice' })]);
		await repo.findByHandle('alice');
		await repo.findByHandle('alice');
		expect(mockReadFile).toHaveBeenCalledTimes(2);
	});

	it('should not cache findByEmail results', async () => {
		setFileContent([makeUser({ username: 'alice@test.com' })]);
		await repo.findByEmail('alice@test.com');
		await repo.findByEmail('alice@test.com');
		expect(mockReadFile).toHaveBeenCalledTimes(2);
	});

	it('should not cache findAll results', async () => {
		setFileContent([makeUser()]);
		await repo.findAll();
		await repo.findAll();
		expect(mockReadFile).toHaveBeenCalledTimes(2);
	});
});





describe('Edge cases', () => {
	let repo: AdminUserRepository;

	beforeEach(() => {
		repo = new AdminUserRepository();
	});

	it('should handle malformed JSON by throwing', async () => {
		mockReadFile.mockResolvedValue('not valid json{{{');
		await expect(repo.findAll()).rejects.toThrow();
	});

	it('should handle file permissions error on chmod gracefully', async () => {
		mockChmod.mockRejectedValue(new Error('Operation not permitted'));
		setFileContent([]);
		
		await expect(repo.create({ handle: 'newadmin', password: 'pass' })).resolves.toBeDefined();
	});

	it('should handle write error by throwing', async () => {
		mockWriteFile.mockRejectedValue(new Error('Disk full'));
		setFileContent([]);
		await expect(repo.create({ handle: 'newadmin', password: 'pass' })).rejects.toThrow('Disk full');
	});

	it('should handle users with extra fields via index signature', async () => {
		const userWithExtras = makeUser({ id: 'u1' });
		(userWithExtras as Record<string, unknown>).customField = 'customValue';
		setFileContent([userWithExtras]);
		const user = await repo.findById('u1');
		expect((user as Record<string, unknown>).customField).toBe('customValue');
	});

	it('should handle empty string handle gracefully', async () => {
		setFileContent([makeUser({ handle: '' })]);
		const user = await repo.findByHandle('');
		expect(user).toBeTruthy();
	});

	it('should provide a singleton instance', () => {
		expect(adminUserRepository).toBeInstanceOf(AdminUserRepository);
	});

	it('should allow creating separate instances', () => {
		const repo1 = new AdminUserRepository();
		const repo2 = new AdminUserRepository();
		expect(repo1).not.toBe(repo2);
	});

	it('should handle concurrent reads returning same data', async () => {
		setFileContent([makeUser({ id: 'u1' }), makeUser({ id: 'u2' })]);
		const [all, byId, byHandle] = await Promise.all([
			repo.findAll(),
			repo.findById('u1'),
			repo.findByHandle('testuser'),
		]);
		expect(all).toHaveLength(2);
		expect(byId).toBeTruthy();
		expect(byHandle).toBeTruthy();
	});
});
