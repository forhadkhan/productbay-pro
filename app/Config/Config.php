<?php
/**
 * Central configuration for ProductBay Pro.
 *
 * Contains all constants, URLs, API endpoints, and option keys
 * used throughout the plugin. Update values here instead of scattered files.
 *
 * @package ProductBayPro
 */

declare(strict_types=1);

namespace WpabProductBayPro\Config;

// Exit if accessed directly.
if (!defined('ABSPATH')) {
	exit;
}

/**
 * Central configuration class for ProductBay Pro.
 *
 * All constants are defined as static properties for easy access
 * and maintenance. Use `Config::VERSION` instead of hardcoded strings.
 *
 * @since 1.0.0
 */
final class Config
{
	/**
	 * Plugin identity.
	 */
	public const VERSION = '1.0.0';
	public const PLUGIN_NAME = 'productbay-pro';
	public const TEXT_DOMAIN = 'productbay-pro';
	public const PLUGIN_BASENAME = 'productbay-pro/productbay-pro.php';

	/**
	 * Minimum required free plugin version.
	 */
	public const MIN_FREE_VERSION = '1.2.0';

	/**
	 * License server.
	 */
	public const LICENSE_SERVER_URL = 'https://wpanchorbay.com/wp-json/license-server/v1';
	public const LICENSE_SERVER_SLUG = 'productbay-pro';

	/**
	 * REST API.
	 */
	public const REST_NAMESPACE = 'productbay/v1';
	public const REST_PREFIX = '/pro';

	/**
	 * Option keys for WordPress database.
	 */
	public const OPT_LICENSE = 'productbay_pro_license';

	// Legacy keys kept for migration
	public const OPT_LICENSE_KEY = 'productbay_pro_license_key';
	public const OPT_LICENSE_STATUS = 'productbay_pro_license_status';
	public const OPT_LICENSE_EXPIRES = 'productbay_pro_license_expires';

	/**
	 * Transient keys.
	 */
	public const TRANSIENT_LICENSE_CACHE = 'productbay_pro_license_cache';

	/**
	 * Cache durations (in seconds).
	 */
	public const CACHE_TTL = DAY_IN_SECONDS;
	public const GRACE_TTL = 259200; // 3 * DAY_IN_SECONDS

	/**
	 * HTTP request timeout.
	 */
	public const TIMEOUT = 15;

	/**
	 * AJAX actions.
	 */
	public const AJAX_VARIATIONS = 'productbay_pro_get_variation_html';

	/**
	 * Nonce actions.
	 */
	public const NONCE_VARIATIONS = 'productbay_pro_variations_nonce';

	/**
	 * Get the REST API URL for a given endpoint.
	 *
	 * @since 1.0.0
	 *
	 * @param string $endpoint The endpoint path (e.g., 'license', 'export').
	 * @return string Full REST URL.
	 */
	public static function rest_url(string $endpoint): string
	{
		return self::REST_NAMESPACE . self::REST_PREFIX . '/' . $endpoint;
	}

	/**
	 * Get the license server URL for a given endpoint.
	 *
	 * @since 1.0.0
	 *
	 * @param string $endpoint The endpoint path (e.g., 'activate', 'check').
	 * @return string Full license server URL.
	 */
	public static function license_server_url(string $endpoint): string
	{
		return self::LICENSE_SERVER_URL . '/' . $endpoint;
	}

	/**
	 * Get the plugin directory path.
	 *
	 * @since 1.0.0
	 *
	 * @return string Plugin directory path.
	 */
	public static function plugin_path(): string
	{
		return defined('PRODUCTBAY_PRO_PATH') ? PRODUCTBAY_PRO_PATH : \plugin_dir_path(__DIR__ . '/../../');
	}

	/**
	 * Get the plugin directory URL.
	 *
	 * @since 1.0.0
	 *
	 * @return string Plugin directory URL.
	 */
	public static function plugin_url(): string
	{
		return defined('PRODUCTBAY_PRO_URL') ? PRODUCTBAY_PRO_URL : \plugin_dir_url(__DIR__ . '/../../');
	}

	/**
	 * Get the frontend JS asset URL.
	 *
	 * @since 1.0.0
	 *
	 * @return string Frontend JS URL.
	 */
	public static function frontend_js_url(): string
	{
		return self::plugin_url() . 'assets/js/productbay-pro-frontend.js';
	}

	/**
	 * Get the frontend CSS asset URL.
	 *
	 * @since 1.0.0
	 *
	 * @return string Frontend CSS URL.
	 */
	public static function frontend_css_url(): string
	{
		return self::plugin_url() . 'assets/css/productbay-pro-frontend.css';
	}

	/**
	 * Get the admin JS asset URL.
	 *
	 * @since 1.0.0
	 *
	 * @return string Admin JS URL.
	 */
	public static function admin_js_url(): string
	{
		return self::plugin_url() . 'assets/js/productbay-pro-admin.js';
	}

	/**
	 * Get the admin CSS asset URL.
	 *
	 * @since 1.0.0
	 *
	 * @return string Admin CSS URL.
	 */
	public static function admin_css_url(): string
	{
		return self::plugin_url() . 'assets/css/productbay-pro-admin.css';
	}
}
