<?php
/**
 * Import/Export Module for ProductBay Pro.
 *
 * Handles the logic for migrating table configurations and global settings
 * between WordPress installations via JSON files.
 *
 * @package ProductBayPro
 */

declare(strict_types=1);

namespace WpabProductBayPro\Modules\ImportExport;

use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;
use WpabProductBay\Data\TableRepository;

/**
 * Class ImportExportModule
 *
 * Provides REST endpoints and processing logic for Import/Export.
 *
 * @since 1.2.0
 */
class ImportExportModule
{
	/**
	 * Table Repository instance from the free plugin.
	 *
	 * @var TableRepository
	 */
	private $table_repository;

	/**
	 * Initialize the module.
	 *
	 * @since 1.2.0
	 */
	public function init()
	{
		$this->table_repository = new TableRepository();

		// Register REST API routes.
		\add_action('rest_api_init', array($this, 'register_routes'));
	}

	/**
	 * Register REST API routes for Import/Export.
	 *
	 * @since 1.2.0
	 */
	public function register_routes()
	{
		\register_rest_route(
			'productbay/v1',
			'/pro/export',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array($this, 'handle_export'),
				'permission_callback' => array($this, 'check_permissions'),
			)
		);

		\register_rest_route(
			'productbay/v1',
			'/pro/import',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array($this, 'handle_import'),
				'permission_callback' => array($this, 'check_permissions'),
			)
		);
	}

	/**
	 * Permission callback for Import/Export routes.
	 *
	 * @since 1.2.0
	 * @return bool
	 */
	public function check_permissions()
	{
		return \current_user_can('manage_options');
	}

	/**
	 * Handle the Export request.
	 *
	 * @since 1.2.0
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function handle_export(WP_REST_Request $request)
	{
		$params           = $request->get_json_params();
		$table_ids        = $params['table_ids'] ?? array();
		$include_settings = $params['include_settings'] ?? false;

		$export_data = array(
			'source'    => \get_site_url(),
			'version'   => \PRODUCTBAY_PRO_VERSION,
			'timestamp' => \time(),
			'tables'    => array(),
			'settings'  => array(),
		);

		// Export Tables.
		foreach ($table_ids as $id) {
			$table = $this->table_repository->get_table((int) $id);
			if ($table) {
				// Remove ID to ensure fresh import if needed, 
				// but keep it in metadata for reference if overwriting.
				$export_data['tables'][] = $table;
			}
		}

		// Export Global Settings.
		if ($include_settings) {
			$export_data['settings'] = \get_option('productbay_settings', array());
		}

		return new WP_REST_Response(array(
			'success' => true,
			'data'    => $export_data,
		), 200);
	}

	/**
	 * Handle the Import request.
	 *
	 * @since 1.2.0
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function handle_import(WP_REST_Request $request)
	{
		$params  = $request->get_json_params();
		$data    = $params['data'] ?? array();
		$options = $params['options'] ?? array();

		$overlap_mode      = $options['overlapMode'] ?? 'create';
		$add_imported_title = $options['addImportedTitle'] ?? false;

		$imported_count = 0;
		$skipped_count  = 0;
		$updated_count  = 0;

		// 1. Process Tables.
		if (!empty($data['tables'])) {
			foreach ($data['tables'] as $table_data) {
				$existing_id = null;
				
				// Standardize status to match WP patterns.
				if (!isset($table_data['status'])) {
					$table_data['status'] = 'publish';
				}

				// Check if table exists (by title or maybe previously stored ID).
				// For v1, we check by title to avoid complexity.
				$existing_table = $this->find_existing_table($table_data['title']);

				if ($existing_table) {
					if ($overlap_mode === 'skip') {
						$skipped_count++;
						continue;
					} elseif ($overlap_mode === 'overwrite') {
						$table_data['id'] = $existing_table['id'];
						$updated_count++;
					} else {
						// Create mode: append (Imported) or just create new.
						unset($table_data['id']);
						if ($add_imported_title) {
							$table_data['title'] .= ' ' . __('(Imported)', 'productbay-pro');
						}
						$imported_count++;
					}
				} else {
					unset($table_data['id']);
					$imported_count++;
				}

				// Perform the creation/update.
				$this->table_repository->save_table($table_data);
			}
		}

		// 2. Process Global Settings.
		if (!empty($data['settings'])) {
			$current_settings = \get_option('productbay_settings', array());
			
			if ($overlap_mode === 'overwrite') {
				\update_option('productbay_settings', $data['settings']);
			} else {
				// Merge logic: only add missing keys.
				$merged = \array_merge($data['settings'], $current_settings);
				\update_option('productbay_settings', $merged);
			}
		}

		return new WP_REST_Response(array(
			'success'        => true,
			'imported_count' => $imported_count + $updated_count,
			'skipped_count'  => $skipped_count,
			'message'        => \sprintf(
				__('Import summary: %d tables imported/updated, %d skipped.', 'productbay-pro'),
				$imported_count + $updated_count,
				$skipped_count
			),
		), 200);
	}

	/**
	 * Internal helper to find a table by title.
	 *
	 * @param string $title
	 * @return array|null
	 */
	private function find_existing_table(string $title)
	{
		$tables = $this->table_repository->get_tables();
		foreach ($tables as $table) {
			if ($table['title'] === $title) {
				return $table;
			}
		}
		return null;
	}
}
