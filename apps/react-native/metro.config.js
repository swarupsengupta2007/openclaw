const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// pnpm packages (e.g., markdown-it) resolve transitive deps from their own
// virtual-store node_modules paths. Keep hierarchical lookup enabled.
config.resolver.disableHierarchicalLookup = false;
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
