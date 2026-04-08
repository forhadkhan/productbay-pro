<?php
/**
 * Variable & Grouped Product Enhancements Module.
 *
 * Manages alternate display modes for variable and grouped products in ProductBay tables:
 * - Inline Dropdown: Attribute dropdowns (variable) or child product select (grouped)
 * - Popup Modal: Full-featured modal with per-variation actions and bulk selection
 * - Nested Rows: Expandable rows below the parent with optional default-expanded state
 * - Separate Rows: Each child/variation rendered as an independent table row
 *
 * @package ProductBayPro
 */

declare(strict_types=1);

namespace WpabProductBayPro\Modules\Variations;

use WpabProductBayPro\Config\Config;

// Exit if accessed directly.
if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class VariationsModule
 *
 * Enhances the display of variable and grouped products.
 *
 * @since 1.0.0
 */
class VariationsModule
{
	/**
	 * Stores the current table configuration during render.
	 *
	 * @var array
	 */
	private $current_table = [];

	/**
	 * Initialize the module by registering hooks.
	 *
	 * @since 1.0.0
	 */
	public function init()
	{
		// Pass feature flags to the React admin app
		\add_filter('productbay_admin_script_data', [$this, 'extend_admin_data']);

		// Capture current table config
		\add_action('productbay_before_table', [$this, 'set_current_table']);

		// Override the button cell HTML for variable/grouped products when variation mode is not inline
		\add_filter('productbay_cell_output', [$this, 'override_button_cell'], 20, 3);

		// Output the popup modal HTML shell after the table
		\add_action('productbay_after_table', [$this, 'render_popup_modal'], 10, 1);

		// Output nested rows and separate rows for variable/grouped products
		\add_action('productbay_after_row', [$this, 'render_nested_rows'], 10, 2);

		// Enqueue frontend scripts (if not already handled globally)
		\add_action('productbay_enqueue_frontend_assets', [$this, 'enqueue_frontend_assets']);

		// Synchronize variation styling with main table
		\add_filter('productbay_table_styles', [$this, 'append_variation_styles'], 10, 2);

		// Override the button cell for grouped products in inline mode to render a child-product select
		\add_filter('productbay_cell_output', [$this, 'render_grouped_inline_select'], 21, 3);

		// AJAX endpoints
		\add_action('wp_ajax_' . Config::AJAX_VARIATIONS, [$this, 'render_ajax_variations']);
		\add_action('wp_ajax_nopriv_' . Config::AJAX_VARIATIONS, [$this, 'render_ajax_variations']);
	}

	/**
	 * Capture table config for the current render loop.
	 *
	 * @param array $table The full table configuration.
	 */
	public function set_current_table($table)
	{
		$this->current_table = $table;
	}

	/**
	 * Extend admin script data to tell React this feature is active.
	 *
	 * @param array $data Existing admin data.
	 * @return array Modified data.
	 */
	public function extend_admin_data($data)
	{
		if (!isset($data['proFeatures'])) {
			$data['proFeatures'] = [];
		}
		$data['proFeatures']['variations'] = true;
		return $data;
	}

	// ─── Mode Resolution ──────────────────────────────────────────────────────────

	/**
	 * Resolve the effective display mode for a given product.
	 *
	 * Reads the new per-type settings (variableProductMode / groupedProductMode)
	 * with automatic fallback to the legacy unified variationsMode for backward
	 * compatibility with tables saved before the settings were split.
	 *
	 * @param \WC_Product $product The WooCommerce product object.
	 * @param array|null  $settings Optional settings override; defaults to current_table settings.
	 * @return string One of: 'inline', 'popup', 'nested', 'separate'.
	 */
	private function resolve_mode($product, $settings = null)
	{
		if ($settings === null) {
			$settings = $this->current_table['settings'] ?? [];
		}

		$features = $settings['features'] ?? [];

		// Legacy fallback: if new keys are absent, use the old unified key
		$legacy = $features['variationsMode'] ?? 'inline';

		if ($product->is_type('variable')) {
			return $features['variableProductMode'] ?? $legacy;
		}

		if ($product->is_type('grouped')) {
			// For grouped, legacy 'inline' maps to 'popup' since inline was never supported
			// for grouped before. New key takes precedence.
			$grouped_legacy = ($legacy === 'inline') ? 'popup' : $legacy;
			return $features['groupedProductMode'] ?? $grouped_legacy;
		}

		return 'inline'; // Non-variable, non-grouped products don't need mode overrides
	}

	// ─── Button Cell Override ──────────────────────────────────────────────────────

	/**
	 * Override the "Add to Cart" button cell output for variable/grouped products.
	 *
	 * For popup/nested modes: replaces the cell with a trigger button.
	 * For separate mode: empties the cell (children are rendered as own rows).
	 * For inline mode: returns original HTML unchanged.
	 *
	 * @param string      $html    The existing cell HTML.
	 * @param array       $col     The column configuration.
	 * @param \WC_Product $product The WooCommerce product object.
	 * @return string Modified HTML.
	 */
	public function override_button_cell($html, $col, $product)
	{
		if ($col['type'] !== 'button') {
			return $html;
		}

		if (!$product->is_type('variable') && !$product->is_type('grouped')) {
			return $html;
		}

		$mode = $this->resolve_mode($product);

		if ($mode === 'inline') {
			return $html;
		}

		$table_id = $this->current_table['id'] ?? 0;

		// Separate mode: parent row shows no button; children are separate rows with their own buttons
		if ($mode === 'separate') {
			return '<div class="productbay-btn-cell"><span class="productbay-pro-parent-label">' . esc_html__('See items below', 'productbay-pro') . '</span></div>';
		}

		$text = $mode === 'popup' ? __('Select Options', 'productbay-pro') : __('View Products', 'productbay-pro');
		$class = $mode === 'popup' ? 'productbay-pro-btn-popup' : 'productbay-pro-btn-nested';

		ob_start();
		?>
		<div class="productbay-btn-cell">
			<button class="productbay-button <?php echo esc_attr($class); ?>"
				data-table-id="<?php echo esc_attr((string) $table_id); ?>"
				data-product-id="<?php echo esc_attr((string) $product->get_id()); ?>">
				<?php echo esc_html($text); ?>
			</button>
			<?php if ($mode === 'popup'): ?>
				<div class="productbay-pro-selection-msg" style="display:none;font-size: 13px;color: #15803d;margin-top: 8px;">
				</div>
			<?php endif; ?>
		</div>
		<?php
		return ob_get_clean();
	}

	// ─── Grouped Product Inline Select ────────────────────────────────────────────

	/**
	 * Render an inline `<select>` dropdown for grouped products when mode is 'inline'.
	 *
	 * Uses $product->get_children() and wc_get_product() to build a dropdown
	 * listing child products by name, with price data embedded for JS to read.
	 * When a child is selected, the add-to-cart button targets that child's ID.
	 *
	 * Runs at priority 21 (after override_button_cell at 20) so it only fires
	 * when mode is 'inline' and the product is grouped.
	 *
	 * @param string      $html    The existing cell HTML.
	 * @param array       $col     The column configuration.
	 * @param \WC_Product $product The WooCommerce product object.
	 * @return string Modified HTML.
	 */
	public function render_grouped_inline_select($html, $col, $product)
	{
		if ($col['type'] !== 'button') {
			return $html;
		}

		if (!$product->is_type('grouped')) {
			return $html;
		}

		$mode = $this->resolve_mode($product);
		if ($mode !== 'inline') {
			return $html;
		}

		$children_ids = $product->get_children();
		if (empty($children_ids)) {
			return $html;
		}

		// Build child data for the select dropdown
		$children_data = [];
		foreach ($children_ids as $child_id) {
			$child = wc_get_product($child_id);
			if (!$child || !$child->is_purchasable() || !$child->is_in_stock()) {
				continue;
			}
			$children_data[] = [
				'id'    => $child->get_id(),
				'name'  => $child->get_name(),
				'price' => $child->get_price(),
				'price_html' => $child->get_price_html(),
			];
		}

		if (empty($children_data)) {
			return $html;
		}

		$settings = $this->current_table['settings'] ?? [];
		$show_qty = $settings['cart']['showQuantity'] ?? true;

		// Check if bulk select is enabled on this table
		$bulk_enabled = true;
		$table_id_val = $this->current_table['id'] ?? 0;
		if (!empty($this->current_table['settings']['features']['bulkSelect'])) {
			$bulk_enabled = $this->current_table['settings']['features']['bulkSelect']['enabled'] ?? true;
		}

		ob_start();
		?>
		<div class="productbay-btn-cell productbay-grouped-inline-wrap"
			 data-children="<?php echo esc_attr((string) wp_json_encode($children_data)); ?>">
			<select class="productbay-grouped-child-select">
				<option value=""><?php esc_html_e('Select a product...', 'productbay-pro'); ?></option>
				<?php if (count($children_data) > 1): ?>
					<option value="__all__"><?php esc_html_e('Select All', 'productbay-pro'); ?></option>
				<?php endif; ?>
				<?php foreach ($children_data as $child): ?>
					<option value="<?php echo esc_attr((string) $child['id']); ?>"
							data-price="<?php echo esc_attr((string) $child['price']); ?>">
						<?php echo esc_html($child['name']); ?>
					</option>
				<?php endforeach; ?>
			</select>
			<span class="productbay-grouped-inline-price productbay-price"></span>
			<?php if ($show_qty): ?>
			<div class="productbay-qty-wrap">
				<input type="number" class="productbay-qty" value="1" min="1" step="1" disabled />
				<div class="productbay-qty-btns">
					<button type="button" class="productbay-qty-plus" aria-label="<?php esc_attr_e('Increase', 'productbay-pro'); ?>" disabled>
						<svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 5L5 1L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
					</button>
					<button type="button" class="productbay-qty-minus" aria-label="<?php esc_attr_e('Decrease', 'productbay-pro'); ?>" disabled>
						<svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
					</button>
				</div>
			</div>
			<?php endif; ?>
			<button class="productbay-button productbay-grouped-add-btn"
					data-product-id="" disabled>
				<?php esc_html_e('Add to Cart', 'productbay-pro'); ?>
			</button>
		</div>
		<?php
		return ob_get_clean();
	}

	// ─── Popup Modal ──────────────────────────────────────────────────────────────

	/**
	 * Render the popup modal shell after the table if needed.
	 *
	 * Only outputs the modal when at least one product type is configured for popup mode.
	 *
	 * @param array $table The table config.
	 */
	public function render_popup_modal($table)
	{
		$settings = $table['settings'] ?? [];
		$features = $settings['features'] ?? [];

		// Check if either product type uses popup
		$var_mode = $features['variableProductMode'] ?? ($features['variationsMode'] ?? 'inline');
		$grp_mode = $features['groupedProductMode'] ?? (($features['variationsMode'] ?? 'inline') !== 'inline' ? ($features['variationsMode'] ?? 'inline') : 'popup');

		if ($var_mode !== 'popup' && $grp_mode !== 'popup') {
			return;
		}

		// Output an empty dialog structure that React/JS will populate.
		echo '<dialog class="productbay-pro-variations-modal">';
		echo '<div class="productbay-pro-variations-backdrop"></div>';
		echo '<div class="productbay-pro-variations-content">';
		echo '<button class="productbay-pro-variations-close" aria-label="' . esc_attr__('Close', 'productbay-pro') . '">×</button>';
		echo '<div class="productbay-pro-variations-inner"></div>';
		echo '</div>';
		echo '</dialog>';
	}

	// ─── Nested & Separate Rows ───────────────────────────────────────────────────

	/**
	 * Render nested row containers or separate rows after each product row.
	 *
	 * - nested:   Hidden row container, populated via AJAX or pre-rendered when expanded.
	 * - separate: Server-rendered child/variation rows inline with the table.
	 *
	 * @param \WC_Product $product The current product.
	 * @param array       $table   The table config.
	 */
	public function render_nested_rows($product, $table)
	{
		if (!$product->is_type('variable') && !$product->is_type('grouped')) {
			return;
		}

		$settings = $table['settings'] ?? [];
		$mode = $this->resolve_mode($product, $settings);

		if ($mode === 'nested') {
			$this->render_nested_container($product, $table);
		} elseif ($mode === 'separate') {
			$this->render_separate_rows($product, $table);
		}
	}

	/**
	 * Render the nested row container (hidden by default, populated via AJAX).
	 *
	 * If 'nestedDefaultExpanded' is true, pre-renders the child rows on the server
	 * so they appear immediately without waiting for AJAX.
	 *
	 * @param \WC_Product $product The current product.
	 * @param array       $table   The table config.
	 */
	private function render_nested_container($product, $table)
	{
		$settings = $table['settings'] ?? [];
		$default_expanded = $settings['features']['nestedDefaultExpanded'] ?? false;
		$table_id = $table['id'] ?? 0;
		$display = $default_expanded ? '' : 'display:none;';

		echo '<tr class="productbay-pro-nested-row-container" data-parent-id="' . esc_attr((string) $product->get_id()) . '"'
			. ' data-table-id="' . esc_attr((string) $table_id) . '"'
			. ' data-default-expanded="' . esc_attr($default_expanded ? '1' : '0') . '"'
			. ' style="' . esc_attr($display) . '">';
		echo '<td colspan="100%" class="productbay-pro-nested-row-content">';

		if ($default_expanded) {
			// Pre-render the nested rows server-side
			$children_ids = $product->get_children();
			if (!empty($children_ids)) {
				echo '<table class="productbay-table productbay-pro-nested-table">';
				echo '<tbody>';
				$this->render_nested_rows_ajax($children_ids, $table_id, $product);
				echo '</tbody>';
				echo '</table>';
			}
		} else {
			echo '<div class="productbay-pro-nested-loading">' . esc_html__('Loading...', 'productbay-pro') . '</div>';
		}

		echo '</td>';
		echo '</tr>';
	}

	/**
	 * Render separate rows for each child/variation, appearing as independent table rows.
	 *
	 * Uses the same column structure as the parent table for visual consistency.
	 * Each child row has its own add-to-cart controls and integrates with bulk selection.
	 *
	 * @param \WC_Product $product The parent product.
	 * @param array       $table   The table config.
	 */
	private function render_separate_rows($product, $table)
	{
		$children_ids = $product->get_children();
		if (empty($children_ids)) {
			return;
		}

		$table_id = $table['id'] ?? 0;
		$this->render_nested_rows_ajax($children_ids, $table_id, $product, true);
	}

	// ─── Frontend Assets ──────────────────────────────────────────────────────────

	/**
	 * Enqueue specific frontend assets for this module if needed.
	 * Often handled globally in ProPlugin.php but left here for modularity.
	 */
	public function enqueue_frontend_assets()
	{
		\wp_enqueue_script(
			'productbay-pro-frontend',
			Config::frontend_js_url(),
			['productbay-frontend', 'jquery'],
			(string) time(),
			true
		);
		\wp_enqueue_style(
			'productbay-pro-frontend',
			Config::frontend_css_url(),
			['productbay-frontend'],
			(string) time()
		);

		// Pass ajax url and nonce
		\wp_localize_script('productbay-pro-frontend', 'productbay_pro_ajax', [
			'ajax_url' => admin_url('admin-ajax.php'),
			'nonce' => \wp_create_nonce(Config::NONCE_VARIATIONS)
		]);
	}

	// ─── AJAX Endpoint ────────────────────────────────────────────────────────────

	/**
	 * AJAX endpoint to fetch variations HTML for popup or nested rows.
	 */
	public function render_ajax_variations()
	{
		\check_ajax_referer(Config::NONCE_VARIATIONS, 'nonce');

		$product_id = isset($_POST['product_id']) ? intval($_POST['product_id']) : 0;
		$table_id = isset($_POST['table_id']) ? intval($_POST['table_id']) : 0;
		$mode = isset($_POST['mode']) ? sanitize_key($_POST['mode']) : 'popup';

		if (!$product_id) {
			wp_send_json_error('Invalid product ID');
		}

		$product = wc_get_product($product_id);
		if (!$product || (!$product->is_type('variable') && !$product->is_type('grouped'))) {
			wp_send_json_error('Not a variable or grouped product');
		}

		$children_ids = $product->get_children();

		if (empty($children_ids)) {
			wp_send_json_error('No variations found');
		}

		ob_start();

		if ($mode === 'popup') {
			// Pass table_id so popup can read bulk select settings
			$this->render_popup_table($children_ids, $product, $table_id);
		} else {
			$this->render_nested_rows_ajax($children_ids, $table_id, $product);
		}

		$html = ob_get_clean();
		wp_send_json_success(['html' => $html]);
	}

	// ─── Variation Data Helpers ───────────────────────────────────────────────────

	/**
	 * Takes standard WooCommerce variations and explodes any that allow "Any" attribute
	 * into explicit, individual variations for the UI.
	 *
	 * @param array       $children_ids   Array of child product IDs.
	 * @param \WC_Product $parent_product The parent product.
	 * @return array Array of ['product' => WC_Product, 'attributes' => array] entries.
	 */
	private function get_exploded_variations($children_ids, $parent_product)
	{
		$available_variations = $parent_product->is_type('variable') ? $parent_product->get_available_variations() : [];
		$exploded = [];

		foreach ($children_ids as $child_id) {
			$child = wc_get_product($child_id);
			if (!$child || !$child->is_purchasable() || !$child->is_in_stock()) {
				continue;
			}

			// If it's just a simple product (grouped child), add it as-is
			if (!$child->is_type('variation')) {
				$exploded[] = [
					'product' => $child,
					'attributes' => [],
				];
				continue;
			}

			$attributes = [];
			foreach ($available_variations as $var_data) {
				if ($var_data['variation_id'] === $child_id) {
					$attributes = $var_data['attributes'];
					break;
				}
			}
			if (empty($attributes)) {
				/** @var \WC_Product_Variation $child */
				$attributes = $child->get_variation_attributes();
			}

			// Find which attributes are "Any" (empty string)
			$any_keys = [];
			foreach ($attributes as $key => $val) {
				if ($val === '') {
					$any_keys[] = $key;
				}
			}

			if (empty($any_keys)) {
				// No "Any", just add the exact variation
				$exploded[] = [
					'product' => $child,
					'attributes' => $attributes,
				];
			} else {
				// We need to explode
				$combinations = [$attributes];
				foreach ($any_keys as $key) {
					// Get all available terms for this taxonomy
					$taxonomy = str_replace('attribute_', '', $key);
					$terms = wc_get_product_terms($parent_product->get_id(), $taxonomy, ['fields' => 'slugs']);
					if (!empty($terms) && !is_wp_error($terms)) {
						$new_combinations = [];
						foreach ($combinations as $combo) {
							foreach ($terms as $term_slug) {
								$new_combo = $combo;
								$new_combo[$key] = $term_slug;
								$new_combinations[] = $new_combo;
							}
						}
						$combinations = $new_combinations;
					}
				}

				foreach ($combinations as $combo) {
					$exploded[] = [
						'product' => $child,
						'attributes' => $combo,
					];
				}
			}
		}

		return $exploded;
	}

	/**
	 * Build a display name based on the parent name and variation attributes.
	 *
	 * @param \WC_Product $parent_product The parent product.
	 * @param array       $attributes     The attribute key-value pairs.
	 * @return string Human-readable name like "T-Shirt - Red, Large".
	 */
	private function build_variation_name($parent_product, $attributes)
	{
		$name = $parent_product->get_name();
		if (empty($attributes)) {
			return $name;
		}

		$parts = [];
		foreach ($attributes as $key => $val) {
			$taxonomy = str_replace('attribute_', '', $key);
			$term = get_term_by('slug', $val, $taxonomy);
			if ($term && !is_wp_error($term)) {
				$parts[] = $term->name;
			} else {
				$parts[] = ucfirst(urldecode($val));
			}
		}

		return $name . ' - ' . implode(', ', $parts);
	}

	// ─── Popup Table Rendering ────────────────────────────────────────────────────

	/**
	 * Render the mini-table inside the popup for selecting variations.
	 *
	 * Includes optional bulk-select checkboxes gated on the parent table's
	 * bulkSelect.enabled setting, and quantity +/- buttons that are handled
	 * via delegated events in productbay-pro-frontend.js.
	 *
	 * @param array       $children_ids   Array of child product IDs.
	 * @param \WC_Product $parent_product The parent product.
	 * @param int         $table_id       The table ID (for reading bulk select config).
	 */
	private function render_popup_table($children_ids, $parent_product, $table_id = 0)
	{
		// Read bulk select setting from the table config
		$bulk_enabled = true;
		if ($table_id) {
			$repository = new \WpabProductBay\Data\TableRepository();
			$table = $repository->get_table($table_id);
			if ($table) {
				$bulk_enabled = $table['settings']['features']['bulkSelect']['enabled'] ?? true;
			}
		}

		echo '<div class="productbay-pro-popup-header">';
		echo '<h3>' . esc_html($parent_product->get_name()) . ' - ' . esc_html__('Select Options', 'productbay-pro') . '</h3>';
		echo '</div>';

		echo '<div class="productbay-pro-popup-table-wrap">';
		echo '<table class="productbay-table productbay-pro-popup-table" data-table-id="' . esc_attr((string) $table_id) . '">';
		echo '<thead><tr>';
		echo '<th>' . esc_html__('Product', 'productbay-pro') . '</th>';
		echo '<th>' . esc_html__('Price', 'productbay-pro') . '</th>';
		echo '<th>' . esc_html__('Quantity', 'productbay-pro') . '</th>';
		echo '<th>' . esc_html__('Action', 'productbay-pro') . '</th>';
		if ($bulk_enabled) {
			echo '<th class="productbay-pro-popup-col-select-all"><input type="checkbox" class="productbay-pro-popup-select-all" title="' . esc_attr__('Select all', 'productbay-pro') . '" /></th>';
		}
		echo '</tr></thead>';
		echo '<tbody>';

		$exploded_variations = $this->get_exploded_variations($children_ids, $parent_product);

		foreach ($exploded_variations as $var_data) {
			$child = $var_data['product'];
			$attributes = $var_data['attributes'];

			echo '<tr data-product-type="' . esc_attr($child->get_type()) . '" data-product-id="' . esc_attr((string) $child->get_id()) . '" data-parent-id="' . esc_attr((string) $parent_product->get_id()) . '" data-attributes="' . esc_attr((string) wp_json_encode($attributes)) . '">';

			// Name
			echo '<td class="productbay-pro-popup-col-name">';
			if ($child->is_type('variation')) {
				echo '<span class="productbay-product-title">' . esc_html($this->build_variation_name($parent_product, $attributes)) . '</span>';
			} else {
				echo '<span class="productbay-product-title">' . esc_html($child->get_name()) . '</span>';
			}
			echo '</td>';

			// Price
			echo '<td class="productbay-pro-popup-col-price">';
			echo '<span class="productbay-price">' . wp_kses_post($child->get_price_html()) . '</span>';
			echo '</td>';

			// Quantity
			echo '<td class="productbay-pro-popup-col-qty">';
			$stock_qty = $child->get_stock_quantity();
			$max = ($child->managing_stock() && !$child->backorders_allowed() && $stock_qty !== null) ? $stock_qty : '';

			echo '<div class="productbay-qty-wrap">';
			echo '<input type="number" class="productbay-qty productbay-pro-popup-qty-input" value="1" min="1" max="' . esc_attr((string) $max) . '" step="1" />';
			echo '<div class="productbay-qty-btns">';
			echo '<button type="button" class="productbay-qty-plus" aria-label="' . esc_attr__('Increase', 'productbay-pro') . '">
					<svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 5L5 1L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
				</button>';
			echo '<button type="button" class="productbay-qty-minus" aria-label="' . esc_attr__('Decrease', 'productbay-pro') . '">
					<svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
				</button>';
			echo '</div>';
			echo '</div>';
			echo '</td>';

			// Action
			echo '<td class="productbay-pro-popup-col-action">';
			echo '<button title="Direct add to cart" class="productbay-button productbay-button-sm productbay-pro-popup-add-btn">' . esc_html__('Add to Cart', 'productbay-pro') . '</button>';
			echo '</td>';

			// Bulk Select Checkbox (separate column matching header)
			if ($bulk_enabled) {
				echo '<td class="productbay-pro-popup-col-select">';
				echo '<input type="checkbox" class="productbay-select-product" value="' . esc_attr((string) $child->get_id()) . '" data-price="' . esc_attr((string) $child->get_price()) . '" />';
				echo '</td>';
			}

			echo '</tr>';
		}

		echo '</tbody></table>';
		echo '</div>';

		// Add to Cart message area
		echo '<div class="productbay-pro-popup-message"></div>';
	}

	// ─── Styling ──────────────────────────────────────────────────────────────────

	/**
	 * Append CSS for the variation popup and nested rows using the same configuration as the main table.
	 *
	 * @param string $css   Generated CSS for the main table.
	 * @param array  $table Table configuration.
	 * @return string Modified CSS.
	 * @since 1.0.0
	 */
	public function append_variation_styles($css, $table)
	{
		$style = $table['style'] ?? [];
		$columns = $table['columns'] ?? [];
		$settings = $table['settings'] ?? [];

		if (!class_exists('\WpabProductBay\Frontend\TableRenderer')) {
			return $css;
		}

		$renderer = new \WpabProductBay\Frontend\TableRenderer(new \WpabProductBay\Data\TableRepository());

		// Generate styles for the variation popup modal
		$modal_css = $renderer->generate_styles('.productbay-pro-variations-modal', $style, $columns, $settings);

		// Generate styles for nested rows (they are rows inside a table, but might have nested tables)
		// We target the nested container as a scope
		$nested_css = $renderer->generate_styles('.productbay-pro-nested-row-container', $style, $columns, $settings);

		return $css . $modal_css . $nested_css;
	}

	// ─── Nested/Separate Row Rendering ────────────────────────────────────────────

	/**
	 * Render actual <tr> elements mirroring the parent table columns.
	 *
	 * Used by both nested rows (via AJAX) and separate rows (server-side).
	 * Renders each child/variation as an independent row with full column support.
	 *
	 * @param array       $children_ids   Array of child product IDs.
	 * @param int         $table_id       The table ID.
	 * @param \WC_Product $parent_product The parent product.
	 * @param bool        $is_separate    If true, renders as separate (non-nested) rows.
	 */
	private function render_nested_rows_ajax($children_ids, $table_id, $parent_product, $is_separate = false)
	{
		// Need to get table columns
		$repository = new \WpabProductBay\Data\TableRepository();
		$table = $repository->get_table($table_id);
		if (!$table)
			return;

		$columns = $table['columns'] ?? [];
		$settings = $table['settings'] ?? [];
		$bulk_select = $settings['features']['bulkSelect']['enabled'] ?? true;
		$bulk_pos = $settings['features']['bulkSelect']['position'] ?? 'last';

		$exploded_variations = $this->get_exploded_variations($children_ids, $parent_product);

		$row_class = $is_separate ? 'productbay-pro-separate-row-item' : 'productbay-pro-nested-row-item';

		foreach ($exploded_variations as $var_data) {
			$child = $var_data['product'];
			$attributes = $var_data['attributes'];

			$product_type = $child->is_type('variation') ? 'variation' : 'simple';

			echo '<tr class="' . esc_attr($row_class) . '" data-product-type="' . esc_attr($product_type) . '" data-product-id="' . esc_attr((string) $child->get_id()) . '" data-parent-id="' . esc_attr((string) $parent_product->get_id()) . '" data-attributes="' . esc_attr((string) wp_json_encode($attributes)) . '">';

			// Bulk Select First
			if ($bulk_select && $bulk_pos === 'first') {
				echo '<td class="productbay-col-select"><input type="checkbox" class="productbay-select-product" value="' . esc_attr((string) $child->get_id()) . '" data-price="' . esc_attr((string) $child->get_price()) . '" /></td>';
			}

			foreach ($columns as $col) {
				if ($this->should_hide_column($col)) {
					continue;
				}

				$td_classes = ['productbay-col-' . (string) $col['id']];
				$visibility = $col['advanced']['visibility'] ?? 'default';
				$visibility_class_map = [
					'desktop' => 'productbay-desktop-only',
					'tablet' => 'productbay-tablet-only',
					'mobile' => 'productbay-mobile-only',
					'not-mobile' => 'productbay-hide-mobile',
					'not-desktop' => 'productbay-hide-desktop',
					'not-tablet' => 'productbay-hide-tablet',
					'min-tablet' => 'productbay-min-tablet',
				];

				if (isset($visibility_class_map[$visibility])) {
					$td_classes[] = $visibility_class_map[$visibility];
				}

				echo '<td class="' . esc_attr(implode(' ', $td_classes)) . '">';
				$this->render_nested_cell($col, $child, $parent_product, $attributes);
				echo '</td>';
			}

			// Bulk Select Last
			if ($bulk_select && $bulk_pos === 'last') {
				echo '<td class="productbay-col-select"><input type="checkbox" class="productbay-select-product" value="' . esc_attr((string) $child->get_id()) . '" data-price="' . esc_attr((string) $child->get_price()) . '" /></td>';
			}

			echo '</tr>';
		}
	}

	/**
	 * Light clone of TableRenderer's cell rendering for nested/separate child products.
	 *
	 * Renders appropriate content for each column type, with full attribute names
	 * for variations and proper add-to-cart controls.
	 *
	 * @param array       $col            Column configuration.
	 * @param \WC_Product $product        The child product.
	 * @param \WC_Product $parent_product The parent product (for building variation names).
	 * @param array       $attributes     Variation attributes.
	 */
	private function render_nested_cell($col, $product, $parent_product = null, $attributes = [])
	{
		switch ($col['type']) {
			case 'image':
				echo wp_kses_post($product->get_image('thumbnail'));
				break;
			case 'name':
				// Use full variation name with attributes for variations
				if ($product->is_type('variation') && $parent_product) {
					$display_name = $this->build_variation_name($parent_product, $attributes);
				} else {
					$display_name = $product->get_name();
				}
				echo '<a href="' . esc_url($product->get_permalink()) . '" class="productbay-product-title">' . esc_html($display_name) . '</a>';
				break;
			case 'price':
				echo '<span class="productbay-price">' . wp_kses_post($product->get_price_html()) . '</span>';
				break;
			case 'sku':
				echo esc_html($product->get_sku());
				break;
			case 'stock':
				echo wp_kses_post(wc_get_stock_html($product));
				break;
			case 'button':
				// Output simple Add to Cart with qty
				$stock_qty = $product->get_stock_quantity();
				$max = ($product->managing_stock() && !$product->backorders_allowed() && $stock_qty !== null) ? $stock_qty : '';

				echo '<div class="productbay-btn-cell">';
				echo '<div class="productbay-qty-wrap">';
				echo '<input type="number" class="productbay-qty" value="1" min="1" max="' . esc_attr((string) $max) . '" step="1" />';
				echo '<div class="productbay-qty-btns">';
				echo '<button type="button" class="productbay-qty-plus" aria-label="' . esc_attr__('Increase', 'productbay-pro') . '">
						<svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 5L5 1L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
					</button>';
				echo '<button type="button" class="productbay-qty-minus" aria-label="' . esc_attr__('Decrease', 'productbay-pro') . '">
						<svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
					</button>';
				echo '</div></div>';
				echo '<button class="productbay-button productbay-btn-addtocart" data-product-id="' . esc_attr((string) $product->get_id()) . '">';
				echo esc_html($product->add_to_cart_text());
				echo '</button></div>';
				break;
			case 'summary':
				echo wp_kses_post(wp_trim_words($product->get_short_description(), 10));
				break;
		}
	}

	/**
	 * Check whether a column should be hidden from output.
	 *
	 * @param array $col Column configuration.
	 * @return bool True if the column visibility is set to 'none'.
	 * @since 1.0.0
	 */
	private function should_hide_column($col)
	{
		// Manual visibility override.
		if (($col['advanced']['visibility'] ?? 'default') === 'none') {
			return true;
		}

		return false;
	}
}
