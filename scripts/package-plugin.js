const fs = require('fs-extra');
const archiver = require('archiver');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PLUGIN_SLUG = 'productbay-pro';
const ROOT_DIR = path.join(__dirname, '..');
const BUILD_DIR = path.join(ROOT_DIR, 'dist');
const PLUGIN_DIR = path.join(BUILD_DIR, PLUGIN_SLUG);

// Read version from main plugin file.
const pluginFile = fs.readFileSync(
	path.join(ROOT_DIR, 'productbay-pro.php'),
	'utf8'
);
const versionMatch = pluginFile.match(/^\s*\*\s*Version:\s*(.+)$/m);
const VERSION = versionMatch ? versionMatch[1].trim() : '0.0.0';

// Default: slug-only for distribution.
// Use --versioned flag for archival/GitHub releases.
const includeVersion = process.argv.includes('--versioned');
const ZIP_NAME = includeVersion
	? `${PLUGIN_SLUG}-${VERSION}.zip`
	: `${PLUGIN_SLUG}.zip`;

// Files/Folders to COPY to the release.
const INCLUDES = [
	'app',
	'assets',
	'languages',
	'productbay-pro.php',
	'readme.txt',
	'LICENSE.txt',
	'composer.json',
];

/**
 * Strip `require-dev` and `config` sections from composer.json for production.
 *
 * @param {string} composerPath Path to the copied composer.json in PLUGIN_DIR.
 */
async function stripComposerDevSections(composerPath) {
	const composerData = await fs.readJson(composerPath);
	delete composerData['require-dev'];
	delete composerData.config;
	await fs.writeJson(composerPath, composerData, { spaces: '\t' });
}

/**
 * Recursively remove files by extension from a directory.
 */
async function removeFilesByExtension(dir, ext) {
	const files = await fs.readdir(dir);
	for (const file of files) {
		const fullPath = path.join(dir, file);
		const stat = await fs.stat(fullPath);
		if (stat.isDirectory()) {
			await removeFilesByExtension(fullPath, ext);
		} else if (file.endsWith(ext)) {
			await fs.remove(fullPath);
		}
	}
}

(async () => {
	try {
		console.log(`🚀 Packaging ${PLUGIN_SLUG} v${VERSION}...`);

		// 1. Clean previous builds.
		console.log('🧹 Cleaning old build...');
		await fs.remove(BUILD_DIR);
		await fs.remove(path.join(ROOT_DIR, ZIP_NAME));
		await fs.ensureDir(PLUGIN_DIR);

		// Build JS and CSS assets before copying
		console.log('🏗️ Building assets...');
		execSync('npm run build', { stdio: 'inherit', cwd: ROOT_DIR });

		// 2. Copy plugin files.
		console.log('📂 Copying plugin files...');
		for (const item of INCLUDES) {
			const src = path.join(ROOT_DIR, item);
			const dest = path.join(PLUGIN_DIR, item);
			if (await fs.pathExists(src)) {
				await fs.copy(src, dest);
			}
		}

		// 3. Clean up source maps from the production package.
		console.log('🧹 Removing source maps from package...');
		await removeFilesByExtension(PLUGIN_DIR, '.map');

		// 4. Install production Composer dependencies (in the staging folder).
		// Copy lock file first so composer install is deterministic.
		console.log('📦 Installing production Composer dependencies...');
		const lockSrc = path.join(ROOT_DIR, 'composer.lock');
		if (await fs.pathExists(lockSrc)) {
			await fs.copy(lockSrc, path.join(PLUGIN_DIR, 'composer.lock'));
		}
		execSync('composer install --no-dev --optimize-autoloader', {
			stdio: 'inherit',
			cwd: PLUGIN_DIR,
		});

		// 4. Strip dev sections from composer.json (after install).
		console.log('📝 Cleaning composer.json for production...');
		await stripComposerDevSections(
			path.join(PLUGIN_DIR, 'composer.json')
		);

		// 5. Remove composer.lock from the release (not needed for end-users).
		await fs.remove(path.join(PLUGIN_DIR, 'composer.lock'));

		// 6. Create Zip.
		console.log('🤐 Zipping...');
		const output = fs.createWriteStream(path.join(ROOT_DIR, ZIP_NAME));
		const archive = archiver('zip', { zlib: { level: 9 } });

		output.on('close', () => {
			console.log(
				`✅ Success! Created ${ZIP_NAME} (${archive.pointer()} bytes)`
			);
		});

		archive.on('error', (err) => {
			throw err;
		});

		archive.pipe(output);
		// Puts the 'productbay-pro' folder inside the zip (WP standard).
		archive.directory(BUILD_DIR, false);
		await archive.finalize();
	} catch (err) {
		console.error('❌ Error during build:', err);
		process.exit(1);
	}
})();
