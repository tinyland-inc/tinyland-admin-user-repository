let config = {};
export function configure(c) {
    config = { ...config, ...c };
}
export function getConfig() {
    return {
        usersFilePath: config.usersFilePath ?? process.cwd() + '/content/auth/admin-users.json',
        cacheTtl: config.cacheTtl ?? 5000,
        saltRounds: config.saltRounds ?? 10,
        filePermissions: config.filePermissions ?? 0o666,
    };
}
export function resetConfig() {
    config = {};
}
