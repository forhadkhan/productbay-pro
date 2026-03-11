<?php
/**
 * ProductBay Pro
 *
 * @package           productbay-pro
 * @author            WPAnchorBay
 * @copyright         2026 WPAnchorBay
 * @license           GPL-2.0-or-later
 *
 * @wordpress-plugin
 * Plugin Name:       ProductBay Pro
 * Plugin URI:        https://wpanchorbay.com/products/productbay-pro
 * Description:       Premium add-on for ProductBay — unlock advanced features for your WooCommerce product tables.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Tested up to:      6.9
 * Requires PHP:      7.4
 * Author:            WPAnchorBay
 * Author URI:        https://wpanchorbay.com/
 * Text Domain:       productbay-pro
 * Domain Path:       /languages
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.txt
 * Requires Plugins:  productbay
 */

// Namespace - ProductBay Pro.
namespace WpabProductBayPro;

/**
 * Prevent Direct File Access.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Global Constants.
 */
define( 'PRODUCTBAY_PRO_VERSION', '1.0.0' );
define( 'PRODUCTBAY_PRO_PLUGIN_NAME', 'productbay-pro' );
define( 'PRODUCTBAY_PRO_TEXT_DOMAIN', 'productbay-pro' );
define( 'PRODUCTBAY_PRO_URL', \plugin_dir_url( __FILE__ ) );
define( 'PRODUCTBAY_PRO_PATH', \plugin_dir_path( __FILE__ ) );
define( 'PRODUCTBAY_PRO_PLUGIN_BASENAME', \plugin_basename( __FILE__ ) );

/**
 * Minimum required free plugin version.
 */
define( 'PRODUCTBAY_PRO_MIN_FREE_VERSION', '1.0.1' );

// Autoloader (must be loaded before using any classes).
if ( file_exists( __DIR__ . '/vendor/autoload.php' ) ) {
	require_once __DIR__ . '/vendor/autoload.php';
}

/**
 * Check if the free plugin is active and meets version requirements.
 * If not, show admin notices and bail.
 *
 * @since 1.0.0
 */
function productbay_pro_init() {
	// Check if free plugin is active.
	if ( ! defined( 'PRODUCTBAY_VERSION' ) ) {
		\add_action( 'admin_notices', __NAMESPACE__ . '\\productbay_pro_missing_free_notice' );
		return;
	}

	// Check minimum version of free plugin.
	if ( version_compare( PRODUCTBAY_VERSION, PRODUCTBAY_PRO_MIN_FREE_VERSION, '<' ) ) {
		\add_action( 'admin_notices', __NAMESPACE__ . '\\productbay_pro_version_mismatch_notice' );
		return;
	}

	// All checks passed — bootstrap the pro plugin.
	$pro = new Core\ProPlugin();
	$pro->init();
}
\add_action( 'plugins_loaded', __NAMESPACE__ . '\\productbay_pro_init', 20 );

/**
 * Admin notice: Free plugin not found.
 *
 * @since 1.0.0
 *
 * @return void
 */
function productbay_pro_missing_free_notice() {
	if ( ! \current_user_can( 'activate_plugins' ) ) {
		return;
	}
	echo '<div class="notice notice-error"><p>';
	echo wp_kses_post(
		sprintf(
			/* translators: %s: link to plugins page */
			__( '<strong>ProductBay Pro</strong> requires the free <strong>ProductBay</strong> plugin to be installed and active. Please <a href="%s">install ProductBay</a> first.', 'productbay-pro' ),
			esc_url( admin_url( 'plugin-install.php?s=productbay&tab=search&type=term' ) )
		)
	);
	echo '</p></div>';
}

/**
 * Admin notice: Free plugin version too old.
 *
 * @since 1.0.0
 *
 * @return void
 */
function productbay_pro_version_mismatch_notice() {
	if ( ! \current_user_can( 'activate_plugins' ) ) {
		return;
	}
	echo '<div class="notice notice-error"><p>';
	echo wp_kses_post(
		sprintf(
			/* translators: %s: required version number */
			__( '<strong>ProductBay Pro</strong> requires <strong>ProductBay %s</strong> or higher. Please update the free plugin.', 'productbay-pro' ),
			esc_html( PRODUCTBAY_PRO_MIN_FREE_VERSION )
		)
	);
	echo '</p></div>';
}
