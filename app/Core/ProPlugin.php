<?php
/**
 * Pro plugin bootstrap — registers all hooks into the free plugin.
 *
 * @package ProductBayPro
 */

declare(strict_types=1);

namespace WpabProductBayPro\Core;

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class ProPlugin
 *
 * Main bootstrap class for the ProductBay Pro add-on.
 * Registers all hooks and filters into the free plugin's extensibility API.
 *
 * @package WpabProductBayPro\Core
 * @since 1.0.0
 */
class ProPlugin {

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
	public function init() {
		// Hook into the free plugin's loaded action.
		\add_action( 'productbay_loaded', array( $this, 'on_free_loaded' ) );

		// Extend admin script data to signal pro is active.
		\add_filter( 'productbay_admin_script_data', array( $this, 'extend_admin_data' ) );

		// Extend system status with pro info.
		\add_filter( 'productbay_system_status', array( $this, 'extend_system_status' ) );
	}

	/**
	 * Callback for 'productbay_loaded'.
	 *
	 * Called after the free plugin finishes initializing.
	 * Use this to bootstrap pro-specific components.
	 *
	 * @since 1.0.0
	 *
	 * @param mixed $plugin The free plugin instance.
	 * @return void
	 */
	public function on_free_loaded( $plugin ) {
		// Pro components will be initialized here.
		// Example: new \WpabProductBayPro\Features\AdvancedExport();
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
	public function extend_admin_data( $data ) {
		$data['proActive']   = true;
		$data['proVersion']  = PRODUCTBAY_PRO_VERSION;

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
	public function extend_system_status( $status ) {
		$status['pro_active']  = true;
		$status['pro_version'] = PRODUCTBAY_PRO_VERSION;

		return $status;
	}
}
