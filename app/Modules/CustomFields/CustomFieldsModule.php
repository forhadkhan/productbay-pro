<?php
/**
 * Custom Fields & Advanced Meta Selector Module.
 *
 * Provides advanced meta-key discovery, ACF integration, and enhanced
 * custom field rendering for product table columns.
 *
 * @package ProductBayPro
 */

declare(strict_types=1);

namespace WpabProductBayPro\Modules\CustomFields;

// Exit if accessed directly.
if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class CustomFieldsModule
 *
 * Enhances the free plugin's basic custom field column with:
 * - REST API endpoint for meta-key discovery
 * - ACF field group detection
 * - Advanced cell rendering (URL/image/date auto-detection)
 *
 * @since 1.1.0
 */
class CustomFieldsModule
{
	/**
	 * Known WooCommerce internal meta keys that should be grouped under "WooCommerce".
	 *
	 * @var array<string, string>
	 */
	private const WC_META_KEYS = array(
		'_weight'         => 'Weight',
		'_length'         => 'Length',
		'_width'          => 'Width',
		'_height'         => 'Height',
		'_purchase_note'  => 'Purchase Note',
		'total_sales'     => 'Total Sales',
		'_sale_price'     => 'Sale Price',
		'_regular_price'  => 'Regular Price',
		'_tax_status'     => 'Tax Status',
		'_tax_class'      => 'Tax Class',
		'_manage_stock'   => 'Manage Stock',
		'_backorders'     => 'Backorders',
		'_sold_individually' => 'Sold Individually',
		'_virtual'        => 'Virtual',
		'_downloadable'   => 'Downloadable',
		'_download_limit' => 'Download Limit',
		'_download_expiry' => 'Download Expiry',
		'_stock'          => 'Stock Quantity',
		'_stock_status'   => 'Stock Status',
		'_low_stock_amount' => 'Low Stock Amount',
	);

	/**
	 * WooCommerce internal meta keys that should be hidden from the selector.
	 * These are managed internally and not useful for display.
	 *
	 * @var string[]
	 */
	private const HIDDEN_META_KEYS = array(
		'_edit_lock',
		'_edit_last',
		'_wp_old_slug',
		'_wp_old_date',
		'_product_image_gallery',
		'_thumbnail_id',
		'_product_attributes',
		'_default_attributes',
		'_product_version',
		'_children',
		'_variation_description',
		'_wc_average_rating',
		'_wc_rating_count',
		'_wc_review_count',
		'_upsell_ids',
		'_crosssell_ids',
		'_sku',
		'_price',
		'_wp_trash_meta_status',
		'_wp_trash_meta_time',
		'_wp_desired_post_slug',
	);

	/**
	 * Initialize the module by registering hooks.
	 *
	 * @since 1.1.0
	 */
	public function init()
	{
		// Pass feature flags to the React admin app.
		\add_filter('productbay_admin_script_data', array($this, 'extend_admin_data'));

		// Register Pro REST endpoint for meta-key discovery.
		\add_action('rest_api_init', array($this, 'register_routes'));

		// Override free plugin's basic cf rendering with advanced formatting.
		\add_filter('productbay_cell_output', array($this, 'render_advanced_cf'), 20, 3);
	}

	/**
	 * Extend admin script data to signal that customFields feature is active.
	 *
	 * @since 1.1.0
	 *
	 * @param array $data Existing admin data.
	 * @return array Modified data.
	 */
	public function extend_admin_data($data)
	{
		if (!isset($data['proFeatures'])) {
			$data['proFeatures'] = array();
		}
		$data['proFeatures']['customFields'] = true;

		// Detect installed third-party field plugins.
		$data['proFeatures']['detectedFieldPlugins'] = $this->detect_field_plugins();

		return $data;
	}

	/**
	 * Register the meta-keys discovery REST endpoint.
	 *
	 * @since 1.1.0
	 */
	public function register_routes()
	{
		\register_rest_route(
			'productbay/v1',
			'/pro/meta-keys',
			array(
				'methods'             => 'GET',
				'callback'            => array($this, 'get_meta_keys'),
				'permission_callback' => function () {
					return \current_user_can('manage_woocommerce');
				},
			)
		);
	}

	/**
	 * REST callback: returns all discovered product meta keys grouped by source.
	 *
	 * @since 1.1.0
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response
	 */
	public function get_meta_keys($request)
	{
		global $wpdb;

		// 1. Get all unique meta keys from product posts (cached for 1 hour).
		$cache_key = 'productbay_pro_meta_keys';
		$raw_keys  = \get_transient($cache_key);

		if (false === $raw_keys) {
			$raw_keys = $wpdb->get_col(
				$wpdb->prepare(
					"SELECT DISTINCT pm.meta_key
					 FROM {$wpdb->postmeta} pm
					 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
					 WHERE p.post_type = %s
					 AND p.post_status = 'publish'
					 ORDER BY pm.meta_key ASC",
					'product'
				)
			);
			\set_transient($cache_key, $raw_keys, HOUR_IN_SECONDS);
		}

		if (empty($raw_keys)) {
			return new \WP_REST_Response(
				array(
					'woocommerce' => array(),
					'acf'         => array(),
					'custom'      => array(),
				),
				200
			);
		}

		// 2. Filter out hidden/internal keys.
		$filtered_keys = array_filter(
			$raw_keys,
			function ($key) {
				return !in_array($key, self::HIDDEN_META_KEYS, true);
			}
		);

		// 3. Categorize.
		$woocommerce = array();
		$acf         = array();
		$custom      = array();

		// Detect ACF keys.
		$acf_field_map = $this->get_acf_field_map();

		foreach ($filtered_keys as $key) {
			// Check WooCommerce known keys.
			if (isset(self::WC_META_KEYS[$key])) {
				$woocommerce[] = array(
					'key'   => $key,
					'label' => self::WC_META_KEYS[$key],
					'type'  => $this->guess_wc_type($key),
				);
				continue;
			}

			// Check ACF fields.
			if (isset($acf_field_map[$key])) {
				$acf_field = $acf_field_map[$key];
				$acf[]     = array(
					'key'   => $key,
					'label' => $acf_field['label'] ?? $key,
					'type'  => $acf_field['type'] ?? 'text',
					'group' => $acf_field['group'] ?? '',
				);
				continue;
			}

			// Skip ACF internal reference keys (start with underscore + known ACF pattern).
			if (isset($acf_field_map[ltrim($key, '_')])) {
				continue;
			}

			// Skip remaining underscore-prefixed internal keys.
			if (strpos($key, '_') === 0 && !isset(self::WC_META_KEYS[$key])) {
				continue;
			}

			// Everything else is "custom".
			$custom[] = array(
				'key'   => $key,
				'label' => $this->humanize_key($key),
				'type'  => 'text',
			);
		}

		return new \WP_REST_Response(
			array(
				'woocommerce' => $woocommerce,
				'acf'         => $acf,
				'custom'      => $custom,
			),
			200
		);
	}

	/**
	 * Advanced cell rendering for custom field columns.
	 *
	 * Overrides the free plugin's basic esc_html output with intelligent
	 * formatting: URLs become links, image IDs become <img>, dates get formatted.
	 *
	 * @since 1.1.0
	 *
	 * @param string      $html    The existing cell HTML from free.
	 * @param array       $col     The column configuration.
	 * @param \WC_Product $product The WooCommerce product.
	 * @return string Modified HTML.
	 */
	public function render_advanced_cf($html, $col, $product)
	{
		if ($col['type'] !== 'cf') {
			return $html;
		}

		$settings  = $col['settings'] ?? array();
		$meta_key  = $settings['metaKey'] ?? '';
		$format    = $settings['displayFormat'] ?? 'auto';

		if ($meta_key === '') {
			$fallback = $settings['fallback'] ?? "\xe2\x80\x94";
			return $fallback !== '' ? esc_html($fallback) : $html;
		}

		// Try ACF's get_field() first if available (handles repeaters, galleries, etc.).
		if (function_exists('get_field')) {
			$value = \get_field($meta_key, $product->get_id());
		} else {
			$value = $product->get_meta(sanitize_key($meta_key), true);
		}

		// Apply fallback.
		if ($value === '' || $value === null || $value === false) {
			$fallback = $settings['fallback'] ?? "\xe2\x80\x94";
			return $fallback !== '' ? esc_html($fallback) : $html;
		}

		$prefix = $settings['prefix'] ?? '';
		$suffix = $settings['suffix'] ?? '';

		// Format based on explicit format or auto-detect.
		$formatted = $this->format_value($value, $format, $product);

		if ($prefix !== '' || $suffix !== '') {
			return '<span class="productbay-cf-value">'
				. esc_html($prefix)
				. $formatted
				. esc_html($suffix)
				. '</span>';
		}

		return $formatted;
	}

	/**
	 * Format a meta value based on format setting or auto-detection.
	 *
	 * @since 1.1.0
	 *
	 * @param mixed       $value   The raw meta value.
	 * @param string      $format  The display format (auto, text, image, link, date, number, boolean).
	 * @param \WC_Product $product The WooCommerce product (for context).
	 * @return string Formatted and escaped HTML.
	 */
	private function format_value($value, $format, $product)
	{
		// Handle arrays (ACF repeaters, checkboxes, etc.).
		if (is_array($value)) {
			$parts = array();
			foreach ($value as $item) {
				if (is_array($item)) {
					// Nested array — flatten to string representation.
					$parts[] = esc_html(implode(', ', array_map('strval', array_values($item))));
				} else {
					$parts[] = esc_html((string) $item);
				}
			}
			return implode(', ', $parts);
		}

		$value = (string) $value;

		// Explicit format overrides.
		switch ($format) {
			case 'image':
				return $this->render_as_image($value);

			case 'link':
				return $this->render_as_link($value);

			case 'date':
				return $this->render_as_date($value);

			case 'number':
				return esc_html(number_format_i18n((float) $value));

			case 'boolean':
				$truthy = in_array($value, array('1', 'yes', 'true', 'on'), true);
				$label  = $truthy ? __('Yes', 'productbay-pro') : __('No', 'productbay-pro');
				$class  = $truthy ? 'productbay-badge-yes' : 'productbay-badge-no';
				return '<span class="productbay-cf-badge ' . esc_attr($class) . '">' . esc_html($label) . '</span>';

			case 'text':
				return esc_html($value);

			case 'auto':
			default:
				return $this->auto_format($value);
		}
	}

	/**
	 * Auto-detect value type and format accordingly.
	 *
	 * @since 1.1.0
	 *
	 * @param string $value The value to format.
	 * @return string Formatted HTML.
	 */
	private function auto_format($value)
	{
		// Check if it's a numeric attachment ID (could be an image).
		if (is_numeric($value) && (int) $value > 0) {
			$image_url = \wp_get_attachment_image_url((int) $value, 'thumbnail');
			if ($image_url) {
				return $this->render_as_image($value);
			}
			// Otherwise treat as a number.
			return esc_html($value);
		}

		// Check for URLs.
		if (filter_var($value, FILTER_VALIDATE_URL)) {
			// Check if it's an image URL.
			$extensions = array('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg');
			$lower      = strtolower($value);
			foreach ($extensions as $ext) {
				if (substr($lower, -strlen($ext)) === $ext) {
					return $this->render_as_image($value);
				}
			}
			// Regular URL — render as link.
			return $this->render_as_link($value);
		}

		// Check for date strings.
		if (preg_match('/^\d{4}-\d{2}-\d{2}/', $value)) {
			$timestamp = strtotime($value);
			if ($timestamp !== false) {
				return $this->render_as_date($value);
			}
		}

		// Default: plain text.
		return esc_html($value);
	}

	/**
	 * Render a value as an image.
	 *
	 * @param string $value Attachment ID or image URL.
	 * @return string HTML img tag.
	 */
	private function render_as_image($value)
	{
		if (is_numeric($value)) {
			$img = \wp_get_attachment_image((int) $value, 'thumbnail', false, array('class' => 'productbay-cf-img'));
			return $img ?: esc_html($value);
		}
		return '<img src="' . esc_url($value) . '" alt="" class="productbay-cf-img" loading="lazy" />';
	}

	/**
	 * Render a value as a clickable link.
	 *
	 * @param string $value The URL.
	 * @return string HTML anchor tag.
	 */
	private function render_as_link($value)
	{
		$display = wp_parse_url($value, PHP_URL_HOST) ?: $value;
		return '<a href="' . esc_url($value) . '" target="_blank" rel="noopener noreferrer" class="productbay-cf-link">' . esc_html($display) . '</a>';
	}

	/**
	 * Render a value as a formatted date.
	 *
	 * @param string $value The date string.
	 * @return string Formatted date.
	 */
	private function render_as_date($value)
	{
		$timestamp = strtotime($value);
		if ($timestamp === false) {
			return esc_html($value);
		}
		return esc_html(date_i18n(get_option('date_format'), $timestamp));
	}

	/**
	 * Detect installed third-party field plugins.
	 *
	 * @since 1.1.0
	 *
	 * @return array<string, bool>
	 */
	private function detect_field_plugins()
	{
		return array(
			'acf'      => class_exists('ACF') || function_exists('acf_get_field_groups'),
			'acf_pro'  => class_exists('acf_pro'),
			'metabox'  => class_exists('RWMB_Loader'),
			'pods'     => function_exists('pods'),
			'jet'      => class_exists('Jet_Engine'),
		);
	}

	/**
	 * Get ACF field map (field_name => field config) for product post type.
	 *
	 * @since 1.1.0
	 *
	 * @return array<string, array{label: string, type: string, group: string}>
	 */
	private function get_acf_field_map()
	{
		if (!function_exists('acf_get_field_groups') || !function_exists('acf_get_fields')) {
			return array();
		}

		$map    = array();
		$groups = \acf_get_field_groups(array('post_type' => 'product'));

		foreach ($groups as $group) {
			$fields = \acf_get_fields($group['key']);
			if (!is_array($fields)) {
				continue;
			}

			foreach ($fields as $field) {
				$map[$field['name']] = array(
					'label' => $field['label'],
					'type'  => $field['type'],
					'group' => $group['title'],
				);
			}
		}

		return $map;
	}

	/**
	 * Guess the value type for a known WooCommerce meta key.
	 *
	 * @param string $key The meta key.
	 * @return string Type hint (numeric, boolean, text).
	 */
	private function guess_wc_type($key)
	{
		$numeric = array('_weight', '_length', '_width', '_height', '_sale_price', '_regular_price', '_stock', '_low_stock_amount', '_download_limit', '_download_expiry', 'total_sales');
		$boolean = array('_manage_stock', '_sold_individually', '_virtual', '_downloadable');

		if (in_array($key, $numeric, true)) {
			return 'numeric';
		}
		if (in_array($key, $boolean, true)) {
			return 'boolean';
		}
		return 'text';
	}

	/**
	 * Convert a snake_case or kebab-case key to a human-readable label.
	 *
	 * @param string $key The meta key.
	 * @return string Human-readable label.
	 */
	private function humanize_key($key)
	{
		$label = str_replace(array('_', '-'), ' ', $key);
		return ucwords(trim($label));
	}
}
