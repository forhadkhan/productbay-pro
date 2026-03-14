/**
 * Webpack Configuration - ProductBay Pro
 *
 * Extends @wordpress/scripts default config with custom settings:
 * - Custom entry point for admin React SlotFills
 * - Custom output directory matching PHP enqueue paths
 * - Path alias for cleaner imports (@/ -> src/)
 */
const defaults = require('@wordpress/scripts/config/webpack.config');
const path = require('path');

// Extract package info for the banner
const packageJson = require('./package.json');
let repoUrl = '';
if (packageJson.repository) {
	repoUrl = typeof packageJson.repository === 'string'
		? packageJson.repository
		: packageJson.repository.url || '';
	repoUrl = repoUrl.replace(/^git\+/, '').replace(/\.git$/, '');
}

// Intercept @wordpress/scripts TerserPlugin
if (defaults.optimization && defaults.optimization.minimizer) {
	defaults.optimization.minimizer = defaults.optimization.minimizer.map(plugin => {
		if (plugin.constructor.name === 'TerserPlugin') {
			plugin.options.extractComments = false;
			plugin.options.terserOptions = plugin.options.terserOptions || {};
			plugin.options.terserOptions.format = plugin.options.terserOptions.format || {};
			plugin.options.terserOptions.format.comments = /Copyright|license|GPLv2/i;
		}
		return plugin;
	});
}

module.exports = {
	...defaults,

	// 1. Define Pro entry point
	entry: {
		'productbay-pro-admin': './src/index.tsx',
	},

	// 2. Adjust output folder
	output: {
		...defaults.output,
		path: path.resolve(__dirname, 'assets', 'js'),
		filename: '[name].js',
		clean: false,
	},

	// 3. Setup aliases
	resolve: {
		...defaults.resolve,
		alias: {
			...defaults.resolve.alias,
			'@': path.resolve(__dirname, 'src'),
		},
	},

	// 4. Disable performance hints
	performance: {
		hints: false,
	},

	// 5. Custom Plugins
	plugins: [
		...(defaults.plugins || []),
		new CustomBuildPlugin(),
	],
};
