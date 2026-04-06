<?php
/**
 * Pro plugin bootstrap — registers all hooks into the free plugin.
 *
 * @package ProductBayPro
 */

declare(strict_types=1);

namespace WpabProductBayPro\Core;

// Exit if accessed directly.
if (!defined('ABSPATH')) {
	exit;
}

use WpabProductBayPro\Api\LicenseController;
use WpabProductBayPro\Config\Config;
use WpabProductBayPro\License\LicenseClient;

/**
 * Class ProPlugin
 *
 * Main bootstrap class for the ProductBay Pro add-on.
 * Registers all hooks and filters into the free plugin's extensibility API.
 *
 * @package WpabProductBayPro\Core
 * @since 1.0.0
 */
class ProPlugin
{

	/**
	 * Initialize the pro plugin.
	 *
	 * Hooks into the free plugin's extensibility API.
	 * This method is called from the main plugin file after all dependency
	 * checks have passed.
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	public function init()
	{
		// Hook into the free plugin's loaded action.
		\add_action('productbay_loaded', array($this, 'on_free_loaded'));

		// Extend admin script data to signal pro is active.
		\add_filter('productbay_admin_script_data', array($this, 'extend_admin_data'));

		// Extend system status with pro info.
		\add_filter('productbay_system_status', array($this, 'extend_system_status'));

		// Enqueue Pro admin assets for SlotFill.
		\add_action('productbay_enqueue_admin_assets', array($this, 'enqueue_admin_assets'));

		// Inject Pro CSS into the live preview iframe.
		\add_filter('productbay_preview_css_urls', array($this, 'inject_preview_css'));

		// Inject Pro JS into the live preview iframe.
		\add_filter('productbay_preview_js_urls', array($this, 'inject_preview_js'));

		// Inject Pro CSS into the Gutenberg block editor's iframe.
		\add_filter('productbay_block_editor_css_paths', array($this, 'inject_block_editor_css'));

		// Register REST API routes.
		\add_action('rest_api_init', array($this, 'register_rest_routes'));

		// Add admin notices for license status.
		\add_action('admin_notices', array($this, 'admin_notices'));
	}

	/**
	 * Register REST API routes.
	 *
	 * @since 1.0.0
	 */
	public function register_rest_routes()
	{
		$controller = new LicenseController();
		$controller->register();
	}

	/**
	 * Display admin notices based on license status.
	 *
	 * Uses standard WordPress notice styles across all admin pages,
	 * except the ProductBay admin pages where the React banner handles it.
	 *
	 * @since 1.0.0
	 */
	public function admin_notices()
	{
		// Don't show standard notices on our React app page to avoid double-bannering.
		$screen = get_current_screen();
		if ($screen && strpos($screen->id, 'productbay') !== false) {
			return;
		}

		$client = new LicenseClient();
		$status = $client->get_status();
		$settings_url = admin_url('admin.php?page=productbay-settings&tab=license');

		if ($status === 'inactive' || empty($client->get_key())) {
			echo '<div class="notice notice-info is-dismissible"><p>';
			echo wp_kses_post(sprintf(
				/* translators: %s: settings page url */
				__('<strong>ProductBay Pro</strong> is almost ready. Please <a href="%s">activate your license key</a> to receive automatic updates and premium support.', 'productbay-pro'),
				esc_url($settings_url)
			));
			echo '</p></div>';
		} elseif ($status === 'expired') {
			echo '<div class="notice notice-warning"><p>';
			echo wp_kses_post(sprintf(
				/* translators: %s: settings page url */
				__('Your <strong>ProductBay Pro</strong> license has expired. Please <a href="%s">renew your license</a> to continue receiving updates and premium support.', 'productbay-pro'),
				esc_url($settings_url)
			));
			echo '</p></div>';
		} elseif ($status === 'invalid') {
			echo '<div class="notice notice-error"><p>';
			echo wp_kses_post(sprintf(
				/* translators: %s: settings page url */
				__('Your <strong>ProductBay Pro</strong> license is invalid. Please <a href="%s">check your license key</a>.', 'productbay-pro'),
				esc_url($settings_url)
			));
			echo '</p></div>';
		}
	}

	/**
	 * Inject Pro frontend JS into the Live Preview iframe.
	 *
	 * @since 1.0.0
	 * @param array $urls Existing JS URLs.
	 * @return array Modified JS URLs.
	 */
	public function inject_preview_js($urls)
	{
		$js_file = PRODUCTBAY_PRO_PATH . 'assets/js/productbay-pro-frontend.js';
		$js_ver  = file_exists($js_file) ? filemtime($js_file) : PRODUCTBAY_PRO_VERSION;
		
		$urls[] = PRODUCTBAY_PRO_URL . 'assets/js/productbay-pro-frontend.js?ver=' . $js_ver;
		
		return $urls;
	}

	/**
	 * Inject Pro frontend CSS into the Live Preview iframe.
	 *
	 * @since 1.0.0
	 * @param array $urls Existing CSS URLs.
	 * @return array Modified CSS URLs.
	 */
	public function inject_preview_css($urls)
	{
		$css_file = PRODUCTBAY_PRO_PATH . 'assets/css/productbay-pro-frontend.css';
		$css_ver  = file_exists($css_file) ? filemtime($css_file) : PRODUCTBAY_PRO_VERSION;
		
		$urls[] = PRODUCTBAY_PRO_URL . 'assets/css/productbay-pro-frontend.css?ver=' . $css_ver;
		
		return $urls;
	}

	/**
	 * Inject Pro frontend CSS into the Gutenberg block editor iframe.
	 *
	 * Hooks into the free plugin's `productbay_block_editor_css_paths` filter
	 * so Pro UI elements (price slider, variation modals, etc.) render correctly
	 * in the ServerSideRender preview.
	 *
	 * @since 1.0.0
	 * @param string[] $paths Existing CSS file paths.
	 * @return string[] Modified paths.
	 */
	public function inject_block_editor_css($paths)
	{
		$paths[] = PRODUCTBAY_PRO_PATH . 'assets/css/productbay-pro-frontend.css';
		return $paths;
	}

	/**
	 * Enqueue Pro admin assets.
	 *
	 * @since 1.0.0
	 */
	public function enqueue_admin_assets()
	{
		$asset_file = PRODUCTBAY_PRO_PATH . 'assets/js/productbay-pro-admin.asset.php';
		if (!file_exists($asset_file)) {
			return;
		}

		$asset = require $asset_file;

		\wp_enqueue_script(
			'productbay-pro-admin',
			Config::admin_js_url(),
			array_merge($asset['dependencies'], array('productbay-admin', 'wp-components', 'wp-element', 'wp-i18n')),
			(string) time(),
			true
		);

		\wp_enqueue_style(
			'productbay-pro-admin',
			Config::admin_css_url(),
			array('productbay-admin-css'),
			(string) time()
		);
	}

	/**
	 * Callback for 'productbay_loaded'.
	 *
	 * Called after the free plugin finishes initializing.
	 * Use this to bootstrap pro-specific components.
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	public function on_free_loaded()
	{
		// Initialize Pro modules.
		new \WpabProductBayPro\Modules\PriceFilter\PriceFilterModule();
		
		$variations_module = new \WpabProductBayPro\Modules\Variations\VariationsModule();
		$variations_module->init();

		$custom_fields_module = new \WpabProductBayPro\Modules\CustomFields\CustomFieldsModule();
		$custom_fields_module->init();

		$import_export_module = new \WpabProductBayPro\Modules\ImportExport\ImportExportModule();
		$import_export_module->init();
	}

	/**
	 * Extend admin script data for the React app.
	 *
	 * Adds pro-related flags to the data passed to the frontend.
	 *
	 * @since 1.0.0
	 *
	 * @param array $data The localized script data.
	 * @return array Modified script data.
	 */
	public function extend_admin_data($data)
	{
		$data['proActive'] = true;
		$data['proVersion'] = PRODUCTBAY_PRO_VERSION;

		$client = new LicenseClient();
		$data['license'] = array(
			'status'    => $client->get_status(),
			'isValid'   => $client->is_valid(),
			'maskedKey' => $client->get_masked_key(),
			'expiresAt' => $client->get_expires(),
		);

		return $data;
	}

	/**
	 * Extend system status with pro plugin info.
	 *
	 * @since 1.0.0
	 *
	 * @param array $status The system status data.
	 * @return array Modified status data.
	 */
	public function extend_system_status($status)
	{
		$status['pro_active'] = true;
		$status['pro_version'] = PRODUCTBAY_PRO_VERSION;

		return $status;
	}
}