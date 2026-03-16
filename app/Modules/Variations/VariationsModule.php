<?php
/**
 * Variable & Grouped Product Enhancements Module.
 *
 * @package ProductBayPro
 */

declare(strict_types=1);

namespace WpabProductBayPro\Modules\Variations;

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

		// Output nested rows for variable/grouped products
		\add_action('productbay_after_row', [$this, 'render_nested_rows'], 10, 2);

		// Enqueue frontend scripts (if not already handled globally)
		\add_action('productbay_enqueue_frontend_assets', [$this, 'enqueue_frontend_assets']);
		
		// AJAX endpoints
		\add_action('wp_ajax_productbay_pro_get_variation_html', [$this, 'render_ajax_variations']);
		\add_action('wp_ajax_nopriv_productbay_pro_get_variation_html', [$this, 'render_ajax_variations']);
	}

	/**
	 * Capture table config for the current render loop.
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

	/**
	 * Override the "Add to Cart" button cell output.
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

		$settings = $this->current_table['settings'] ?? [];
		$mode     = $settings['features']['variationsMode'] ?? 'inline';

		if ($mode === 'inline') {
			return $html;
		}

		$table_id = $this->current_table['id'] ?? 0;
		$text     = $mode === 'popup' ? __('Select Products', 'productbay-pro') : __('View Products', 'productbay-pro');
		$class    = $mode === 'popup' ? 'productbay-pro-btn-popup' : 'productbay-pro-btn-nested';

		ob_start();
		?>
		<div class="productbay-btn-cell">
			<button class="productbay-button <?php echo esc_attr($class); ?>" data-table-id="<?php echo esc_attr((string)$table_id); ?>" data-product-id="<?php echo esc_attr((string)$product->get_id()); ?>">
				<?php echo esc_html($text); ?>
			</button>
			<?php if ($mode === 'popup'): ?>
				<div class="productbay-pro-selection-msg" style="display:none;font-size: 13px;color: #15803d;margin-top: 8px;"></div>
			<?php endif; ?>
		</div>
		<?php
		return ob_get_clean();
	}

	/**
	 * Render the popup modal shell after the table if needed.
	 *
	 * @param array $table The table config.
	 */
	public function render_popup_modal($table)
	{
		$settings = $table['settings'] ?? [];
		
		// If explicit setting is missing, standard behavior is inline for free.
		// If Pro is active but setting is empty, assume inline by default.
		$mode     = $settings['features']['variationsMode'] ?? 'inline';

		if ($mode !== 'popup') {
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

	/**
	 * Render nested rows after each row if needed.
	 *
	 * @param \WC_Product $product The current product.
	 * @param array       $table   The table config.
	 */
	public function render_nested_rows($product, $table)
	{
		$settings = $table['settings'] ?? [];
		$mode     = $settings['features']['variationsMode'] ?? 'inline';

		if ($mode !== 'nested') {
			return;
		}

		if (!$product->is_type('variable') && !$product->is_type('grouped')) {
			return;
		}

		// Output an empty nested row container that React/JS will populate, or pre-render here.
		// A full implementation would pre-render the variations.
		echo '<tr class="productbay-pro-nested-row-container" data-parent-id="' . esc_attr((string) $product->get_id()) . '" style="display:none;">';
		echo '<td colspan="100%" class="productbay-pro-nested-row-content">';
		echo 'Loading variations...'; // Handled by JS
		echo '</td>';
		echo '</tr>';
	}

	/**
	 * Enqueue specific frontend assets for this module if needed.
	 * Often handled globally in ProPlugin.php but left here for modularity.
	 */
	public function enqueue_frontend_assets()
	{
		\wp_enqueue_script(
			'productbay-pro-frontend',
			defined('PRODUCTBAY_PRO_URL') ? PRODUCTBAY_PRO_URL . 'assets/js/productbay-pro-frontend.js' : plugin_dir_url(dirname(__DIR__, 2)) . 'assets/js/productbay-pro-frontend.js',
			['productbay-frontend', 'jquery'],
			(string) time(),
			true
		);
		\wp_enqueue_style(
			'productbay-pro-frontend',
			defined('PRODUCTBAY_PRO_URL') ? PRODUCTBAY_PRO_URL . 'assets/css/productbay-pro-frontend.css' : plugin_dir_url(dirname(__DIR__, 2)) . 'assets/css/productbay-pro-frontend.css',
			['productbay-frontend'],
			(string) time()
		);

		// Pass ajax url
		\wp_localize_script('productbay-pro-frontend', 'productbay_pro_ajax', [
			'ajax_url' => admin_url('admin-ajax.php')
		]);
	}

	/**
	 * AJAX endpoint to fetch variations HTML for popup or nested rows.
	 */
	public function render_ajax_variations()
	{
		$product_id = isset($_POST['product_id']) ? intval($_POST['product_id']) : 0;
		$table_id   = isset($_POST['table_id']) ? intval($_POST['table_id']) : 0;
		$mode       = isset($_POST['mode']) ? sanitize_key($_POST['mode']) : 'popup';

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
			$this->render_popup_table($children_ids, $product);
		} else {
			$this->render_nested_rows_ajax($children_ids, $table_id, $product);
		}

		$html = ob_get_clean();
		wp_send_json_success(['html' => $html]);
	}

	/**
	 * Takes standard WooCommerce variations and explodes any that allow "Any" attribute
	 * into explicit, individual variations for the UI.
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
					'product'    => $child,
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
					'product'    => $child,
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
						'product'    => $child,
						'attributes' => $combo,
					];
				}
			}
		}

		return $exploded;
	}

	/**
	 * Build a display name based on the attributes.
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

	/**
	 * Render the mini-table inside the popup for selecting variations.
	 */
	private function render_popup_table($children_ids, $parent_product)
	{
		echo '<div class="productbay-pro-popup-header">';
		echo '<h3>' . esc_html($parent_product->get_name()) . ' - ' . esc_html__('Select Options', 'productbay-pro') . '</h3>';
		echo '</div>';

		echo '<div class="productbay-pro-popup-table-wrap">';
		echo '<table class="productbay-pro-popup-table">';
		echo '<thead><tr>';
		echo '<th>' . esc_html__('Product', 'productbay-pro') . '</th>';
		echo '<th>' . esc_html__('Price', 'productbay-pro') . '</th>';
		echo '<th>' . esc_html__('Quantity', 'productbay-pro') . '</th>';
		echo '<th>' . esc_html__('Action', 'productbay-pro') . '</th>';
		echo '</tr></thead>';
		echo '<tbody>';

		$exploded_variations = $this->get_exploded_variations($children_ids, $parent_product);
		
		foreach ($exploded_variations as $var_data) {
			$child = $var_data['product'];
			$attributes = $var_data['attributes'];

			echo '<tr data-product-type="' . esc_attr($child->get_type()) . '" data-product-id="' . esc_attr((string)$child->get_id()) . '" data-parent-id="' . esc_attr((string)$parent_product->get_id()) . '" data-attributes="' . esc_attr((string)wp_json_encode($attributes)) . '">';
			
			// Name
			echo '<td class="productbay-pro-popup-col-name">';
			if ($child->is_type('variation')) {
				echo esc_html($this->build_variation_name($parent_product, $attributes));
			} else {
				echo esc_html($child->get_name());
			}
			echo '</td>';

			// Price
			echo '<td class="productbay-pro-popup-col-price">';
			echo wp_kses_post($child->get_price_html());
			echo '</td>';

			// Quantity
			echo '<td class="productbay-pro-popup-col-qty">';
			$stock_qty = $child->get_stock_quantity();
			$max = ($child->managing_stock() && !$child->backorders_allowed() && $stock_qty !== null) ? $stock_qty : '';
			
			echo '<div class="productbay-qty-wrap">';
			echo '<input type="number" class="productbay-qty productbay-pro-popup-qty-input" value="1" min="1" max="' . esc_attr((string)$max) . '" step="1" />';
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
			echo '<div style="display: flex; gap: 8px; align-items: center; justify-content: flex-end;">';
			echo '<button class="productbay-button productbay-button-sm productbay-pro-popup-add-btn">' . esc_html__('Add', 'productbay-pro') . '</button>';
			echo '<label class="productbay-checkbox" title="' . esc_attr__('Select for bulk add', 'productbay-pro') . '">';
			echo '<input type="checkbox" class="productbay-select-product" value="' . esc_attr((string) $child->get_id()) . '" data-price="' . esc_attr((string) $child->get_price()) . '" />';
			echo '<span class="productbay-checkbox-mark"></span>';
			echo '</label>';
			echo '</div>';
			echo '</td>';

			echo '</tr>';
		}

		echo '</tbody></table>';
		echo '</div>';

        // Add to Cart message area
        echo '<div class="productbay-pro-popup-message"></div>';
	}

	/**
	 * Render actual <tr> elements mirroring the parent table columns.
	 */
	private function render_nested_rows_ajax($children_ids, $table_id, $parent_product)
	{
		// Need to get table columns
		$repository = new \WpabProductBay\Data\TableRepository();
		$table = $repository->get_table($table_id);
		if (!$table) return;

		$columns = $table['columns'] ?? [];
        $settings = $table['settings'] ?? [];
        $bulk_select = $settings['features']['bulkSelect']['enabled'] ?? true;
        $bulk_pos = $settings['features']['bulkSelect']['position'] ?? 'last';

		$exploded_variations = $this->get_exploded_variations($children_ids, $parent_product);

		foreach ($exploded_variations as $var_data) {
			$child = $var_data['product'];
			$attributes = $var_data['attributes'];

			echo '<tr class="productbay-pro-nested-row-item" data-product-type="simple" data-product-id="' . esc_attr((string)$child->get_id()) . '" data-parent-id="' . esc_attr((string)$parent_product->get_id()) . '" data-attributes="' . esc_attr((string)wp_json_encode($attributes)) . '">';

            // Bulk Select First
            if ($bulk_select && $bulk_pos === 'first') {
                echo '<td class="productbay-col-select"><input type="checkbox" class="productbay-select-product" value="' . esc_attr((string)$child->get_id()) . '" data-price="' . esc_attr((string)$child->get_price()) . '" /></td>';
            }

			foreach ($columns as $col) {
				// Mirrors TableRenderer hide logic
				if (!empty($col['advanced']['hideOnMobile']) || !empty($col['advanced']['hideOnTablet']) || !empty($col['advanced']['hideOnDesktop'])) {
					// Add responsive classes - simplified
				}
				echo '<td class="productbay-col-' . esc_attr($col['type']) . '">';
				$this->render_nested_cell($col, $child);
				echo '</td>';
			}

            // Bulk Select Last
            if ($bulk_select && $bulk_pos === 'last') {
                echo '<td class="productbay-col-select"><input type="checkbox" class="productbay-select-product" value="' . esc_attr((string)$child->get_id()) . '" data-price="' . esc_attr((string)$child->get_price()) . '" /></td>';
            }

			echo '</tr>';
		}
	}

	/**
	 * Light clone of TableRenderer's cell rendering for nested simple products.
	 */
	private function render_nested_cell($col, $product)
	{
		switch ($col['type']) {
			case 'image':
				echo wp_kses_post($product->get_image('thumbnail'));
				break;
			case 'name':
				echo '↳ <a href="' . esc_url($product->get_permalink()) . '">' . esc_html($product->get_name()) . '</a>';
				break;
			case 'price':
				echo wp_kses_post($product->get_price_html());
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
				echo '<input type="number" class="productbay-qty" value="1" min="1" max="' . esc_attr((string)$max) . '" step="1" />';
				echo '<div class="productbay-qty-btns">';
				echo '<button type="button" class="productbay-qty-btn productbay-qty-plus">&#9650;</button>';
				echo '<button type="button" class="productbay-qty-btn productbay-qty-minus">&#9660;</button>';
				echo '</div></div>';
				echo '<button class="productbay-button productbay-btn-addtocart" data-product-id="' . esc_attr((string)$product->get_id()) . '">';
				echo esc_html($product->add_to_cart_text());
				echo '</button></div>';
				break;
			case 'summary':
				echo wp_kses_post(wp_trim_words($product->get_short_description(), 10));
				break;
			default:
				echo \apply_filters('productbay_cell_output', '', $col, $product);
		}
	}
}
