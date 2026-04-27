export interface AdminUserRepositoryConfig {
    usersFilePath?: string;
    cacheTtl?: number;
    saltRounds?: number;
    filePermissions?: number;
}
export declare function configure(c: AdminUserRepositoryConfig): void;
export declare function getConfig(): Required<AdminUserRepositoryConfig>;
export declare function resetConfig(): void;
//# sourceMappingURL=config.d.ts.map