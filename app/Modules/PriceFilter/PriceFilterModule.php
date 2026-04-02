<?php
/**
 * Price Filter Module
 *
 * @package ProductBayPro
 */

declare(strict_types=1);

namespace WpabProductBayPro\Modules\PriceFilter;

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class PriceFilterModule
 *
 * Implements the Price Range Filter feature by hooking into the free plugin.
 *
 * @since 1.0.0
 */
class PriceFilterModule {

	/**
	 * Initialize module.
	 */
	public function __construct() {
		// Render price filter HTML in the frontend toolbar.
		\add_action( 'productbay_render_filters', array( $this, 'render_price_filter' ), 10, 2 );

		// Apply price filter to WP_Query.
		\add_filter( 'productbay_query_args', array( $this, 'apply_price_query' ), 10, 3 );

		// Enqueue frontend scripts and styles.
		\add_action( 'productbay_enqueue_frontend_assets', array( $this, 'enqueue_assets' ) );

		// Inform React Admin UI that Price Filter is available in Pro.
		\add_filter( 'productbay_admin_script_data', array( $this, 'extend_admin_data' ) );

		// Add default settings for Price Filter.
		\add_filter( 'productbay_default_settings', array( $this, 'add_default_settings' ) );
	}


	/**
	 * Add default settings for the Price Filter feature.
	 *
	 * @param array $settings Default settings.
	 * @return array
	 */
	public function add_default_settings( $settings ) {
		if ( ! isset( $settings['features']['priceFilter'] ) ) {
			$settings['features']['priceFilter'] = array(
				'enabled' => false,
				'mode'    => 'both',
				'step'    => 1,
			);
		}
		return $settings;
	}

	/**
	 * Extend admin script data to tell React the feature exists.
	 *
	 * @param array $data Admin script data.
	 * @return array
	 */
	public function extend_admin_data( $data ) {
		$data['features']['priceFilter'] = true;
		return $data;
	}

	public function enqueue_assets() {
		$version = (string) time();

		\wp_enqueue_style(
			'productbay-pro-frontend',
			PRODUCTBAY_PRO_URL . 'assets/css/productbay-pro-frontend.css',
			array( 'productbay-frontend' ),
			$version
		);

		\wp_enqueue_script(
			'productbay-pro-frontend',
			PRODUCTBAY_PRO_URL . 'assets/js/productbay-pro-frontend.js',
			array( 'jquery', 'productbay-frontend' ),
			$version,
			true
		);
	}

	/**
	 * Apply the price filter to the WP_Query meta parameters.
	 *
	 * @param array $args         WP_Query args.
	 * @param array $settings     Table settings.
	 * @param array $runtime_args Runtime args from AJAX.
	 * @return array
	 */
	public function apply_price_query( $args, $settings, $runtime_args = array() ) {
		// Check if feature is enabled in settings.
		if ( empty( $settings['features']['priceFilter']['enabled'] ) ) {
			return $args;
		}

		$has_runtime_min = isset( $runtime_args['price_min'] ) && $runtime_args['price_min'] !== '';
		$has_runtime_max = isset( $runtime_args['price_max'] ) && $runtime_args['price_max'] !== '';
		$has_query_min   = isset( $settings['features']['priceFilter']['customMin'] );
		$has_query_max   = isset( $settings['features']['priceFilter']['customMax'] );

		if ( $has_runtime_min || $has_runtime_max || $has_query_min || $has_query_max ) {
			$min = $has_runtime_min ? floatval( $runtime_args['price_min'] ) : ( $has_query_min ? floatval( $settings['features']['priceFilter']['customMin'] ) : -1 );
			$max = $has_runtime_max ? floatval( $runtime_args['price_max'] ) : ( $has_query_max ? floatval( $settings['features']['priceFilter']['customMax'] ) : null );

			// If no runtime values and no custom bounds, don't filter (fallback to auto)
			if ( ! $has_runtime_min && ! $has_runtime_max && ! $has_query_min && ! $has_query_max ) {
				return $args;
			}

			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
			if ( ! isset( $args['meta_query'] ) ) {
				$args['meta_query'] = array();
			}

			$args['meta_query'][] = array(
				'key'     => '_price',
				'value'   => array( $min >= 0 ? $min : 0, $max ? $max : 999999999 ),
				'compare' => 'BETWEEN',
				'type'    => 'NUMERIC',
			);
		}

		return $args;
	}

	/**
	 * Get the min and max price for the current table.
	 *
	 * @param array $source   Database source configuration.
	 * @param array $settings Table settings.
	 * @return array
	 */
	private function get_price_range( $source, $settings ) {
		$custom_min = $settings['features']['priceFilter']['customMin'] ?? null;
		$custom_max = $settings['features']['priceFilter']['customMax'] ?? null;

		if ( null !== $custom_min && null !== $custom_max ) {
			return array(
				'min' => floatval( $custom_min ),
				'max' => floatval( $custom_max ),
			);
		}

		// Auto-detect from this table's products. We do a lightweight query.
		$args = array(
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
		);

		if ( ! empty( $source['categories'] ) ) {
			$args['tax_query'][] = array(
				'taxonomy' => 'product_cat',
				'field'    => 'term_id',
				'terms'    => wp_list_pluck( (array) $source['categories'], 'value' ),
				'operator' => 'IN',
			);
		}

		$args['posts_per_page'] = -1;
		$args['fields']         = 'ids';
		if ( isset( $args['paged'] ) ) {
			unset( $args['paged'] );
		}

		$query = new \WP_Query( $args );
		$min   = PHP_FLOAT_MAX;
		$max   = 0;

		foreach ( $query->posts as $pid ) {
			$product = wc_get_product( $pid );
			if ( ! $product ) {
				continue;
			}
			$price = floatval( $product->get_price() );
			if ( $price < $min ) {
				$min = $price;
			}
			if ( $price > $max ) {
				$max = $price;
			}
		}
		wp_reset_postdata();

		return array(
			'min' => null !== $custom_min ? floatval( $custom_min ) : ( PHP_FLOAT_MAX === $min ? 0 : floor( $min ) ),
			'max' => null !== $custom_max ? floatval( $custom_max ) : ceil( $max ),
		);
	}

	/**
	 * Render price filter HTML.
	 *
	 * @param array $settings Table settings.
	 * @param array $source   Table source.
	 */
	public function render_price_filter( $settings, $source ) {
		$config = $settings['features']['priceFilter'] ?? array();
		if ( empty( $config['enabled'] ) ) {
			return;
		}

		$range = $this->get_price_range( $source, $settings );
		$mode  = $config['mode'] ?? 'both';
		$step  = $config['step'] ?? 1;

		echo '<div class="productbay-price-filter" data-min="' . esc_attr( (string) $range['min'] ) . '" data-max="' . esc_attr( (string) $range['max'] ) . '" data-step="' . esc_attr( (string) $step ) . '" data-mode="' . esc_attr( $mode ) . '">';
		echo '<span class="productbay-filter-label">' . esc_html__( 'Price:', 'productbay-pro' ) . '</span>';

		if ( 'slider' === $mode || 'both' === $mode ) {
			echo '<div class="productbay-price-slider-wrap">';
			echo '<div class="productbay-price-tooltip productbay-price-tooltip-min"></div>';
			echo '<div class="productbay-price-tooltip productbay-price-tooltip-max"></div>';
			echo '<div class="productbay-price-slider-track-fill"></div>';
			echo '<input type="range" class="productbay-price-range-min" min="' . esc_attr( (string) $range['min'] ) . '" max="' . esc_attr( (string) $range['max'] ) . '" value="' . esc_attr( (string) $range['min'] ) . '" step="' . esc_attr( (string) $step ) . '" />';
			echo '<input type="range" class="productbay-price-range-max" min="' . esc_attr( (string) $range['min'] ) . '" max="' . esc_attr( (string) $range['max'] ) . '" value="' . esc_attr( (string) $range['max'] ) . '" step="' . esc_attr( (string) $step ) . '" />';
			echo '</div>';
		}

		if ( 'input' === $mode || 'both' === $mode ) {
			echo '<div class="productbay-price-inputs">';
			echo '<input type="number" class="productbay-price-input-min" value="' . esc_attr( (string) $range['min'] ) . '" min="' . esc_attr( (string) $range['min'] ) . '" max="' . esc_attr( (string) $range['max'] ) . '" step="' . esc_attr( (string) $step ) . '" />';
			echo '<span class="productbay-price-sep">&ndash;</span>';
			echo '<input type="number" class="productbay-price-input-max" value="' . esc_attr( (string) $range['max'] ) . '" min="' . esc_attr( (string) $range['min'] ) . '" max="' . esc_attr( (string) $range['max'] ) . '" step="' . esc_attr( (string) $step ) . '" />';
			echo '</div>';
		}

		echo '</div>';
	}
}
