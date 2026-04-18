<?php
/**
 * License REST API controller.
 *
 * Provides local REST endpoints for the React admin to interact
 * with the license system (get status, activate, remove).
 *
 * @package ProductBayPro
 * @since 1.0.0
 */

declare(strict_types=1);

namespace WpabProductBayPro\Api;

// Exit if accessed directly.
if (!defined('ABSPATH')) {
	exit;
}

use WpabProductBayPro\Config\Config;
use WpabProductBayPro\License\LicenseClient;
use WpabProductBay\Data\ActivityLog;

/**
 * Class LicenseController
 *
 * REST controller for license management.
 * All routes are registered under the productbay/v1 namespace
 * and require the manage_options capability.
 *
 * @package WpabProductBayPro\Api
 * @since 1.0.0
 */
class LicenseController
{

	/**
	 * License client instance.
	 *
	 * @var LicenseClient
	 */
	private LicenseClient $client;

	/**
	 * Constructor.
	 *
	 * @since 1.0.0
	 */
	public function __construct()
	{
		$this->client = new LicenseClient();
	}

	/**
	 * Register REST API routes.
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	public function register(): void
	{
		\register_rest_route(Config::REST_NAMESPACE, Config::REST_PREFIX . '/license', array(
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array($this, 'get_status'),
				'permission_callback' => array($this, 'check_permission'),
			),
			array(
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => array($this, 'activate'),
				'permission_callback' => array($this, 'check_permission'),
				'args'                => array(
					'license_key' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
						'validate_callback' => function ($value) {
							return !empty(trim($value));
						},
					),
				),
			),
			array(
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => array($this, 'remove'),
				'permission_callback' => array($this, 'check_permission'),
			),
		));
	}

	/**
	 * Get current license status.
	 *
	 * @since 1.0.0
	 *
	 * @return \WP_REST_Response
	 */
	public function get_status(): \WP_REST_Response
	{
		return new \WP_REST_Response(array(
			'maskedKey'  => $this->client->get_masked_key(),
			'status'     => $this->client->get_status(),
			'isValid'    => $this->client->is_valid(),
			'expiresAt'  => $this->client->get_expires(),
		));
	}

	/**
	 * Activate a license key.
	 *
	 * @since 1.0.0
	 *
	 * @param \WP_REST_Request $request The REST request.
	 * @return \WP_REST_Response
	 */
	public function activate(\WP_REST_Request $request): \WP_REST_Response
	{
		$key    = $request->get_param('license_key');
		$result = $this->client->activate($key);

		if ($result['success']) {
			ActivityLog::success(
				'License activated',
				sprintf('Pro license key "%s" successfully activated on this site.', $this->client->get_masked_key())
			);
		}

		return new \WP_REST_Response(
			$result,
			$result['success'] ? 200 : 400
		);
	}

	/**
	 * Remove license from this site.
	 *
	 * Clears locally stored license data. Does not deactivate
	 * on the server (no deactivation endpoint available).
	 *
	 * @since 1.0.0
	 *
	 * @return \WP_REST_Response
	 */
	public function remove(): \WP_REST_Response
	{
		$this->client->remove();

		ActivityLog::info(
			'License removed',
			'Pro license data has been cleared from this site.'
		);

		return new \WP_REST_Response(array(
			'success' => true,
			'message' => \__('License removed from this site.', 'productbay-pro'),
		));
	}

	/**
	 * Permission check for all routes.
	 *
	 * @since 1.0.0
	 *
	 * @return bool True if the current user can manage options.
	 */
	public function check_permission(): bool
	{
		return \current_user_can('manage_options');
	}
}
