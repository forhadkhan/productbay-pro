<?php
/**
 * License client for the WPAnchorBay License Server.
 *
 * Wraps the license server REST API endpoints for activation,
 * validation, and caching of license status.
 *
 * @package ProductBayPro
 * @since 1.0.0
 */

declare(strict_types=1);

namespace WpabProductBayPro\License;

use WpabProductBayPro\Config\Config;
use WpabProductBay\Data\ActivityLog;

// Exit if accessed directly.
if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class LicenseClient
 *
 * Communicates with the WPAnchorBay license server to activate,
 * validate, and cache license state for ProductBay Pro.
 *
 * @package WpabProductBayPro\License
 * @since 1.0.0
 */
class LicenseClient
{

	/**
	 * wp_options keys for persisted license data.
	 */
	const OPT_LICENSE = Config::OPT_LICENSE;


	/**
	 * Transient key for cached validation result.
	 */
	const TRANSIENT_KEY = Config::TRANSIENT_LICENSE_CACHE;

	/**
	 * License server base URL.
	 */
	const SERVER_URL = Config::LICENSE_SERVER_URL;

	/**
	 * Software slug registered on the license server.
	 */
	const SLUG = Config::LICENSE_SERVER_SLUG;

	/**
	 * Cache time-to-live: 24 hours.
	 */
	const CACHE_TTL = Config::CACHE_TTL;

	/**
	 * Grace period when server is unreachable: 3 days.
	 */
	const GRACE_TTL = Config::GRACE_TTL;

	/**
	 * HTTP request timeout in seconds.
	 */
	const TIMEOUT = Config::TIMEOUT;

	/**
	 * Activate a license key for this site.
	 *
	 * Sends a POST request to the license server's /activate endpoint.
	 *
	 * @since 1.0.0
	 *
	 * @param string $key The license key to activate.
	 * @return array{success: bool, message: string} Activation result.
	 */
	public function activate(string $key): array
	{
		$response = \wp_remote_post(self::SERVER_URL . '/activate', array(
			'timeout' => self::TIMEOUT,
			'headers' => array('Content-Type' => 'application/json'),
			'body' => \wp_json_encode(array(
				'license_key' => $key,
				'slug' => self::SLUG,
				'domain' => $this->get_domain(),
			)),
		));

		if (\is_wp_error($response)) {
			ActivityLog::error(
				'License activation failed (Network)',
				sprintf('Communication error with license server: %s', $response->get_error_message()),
				json_encode(array(
					'error_code' => $response->get_error_code(),
					'message' => $response->get_error_message(),
					'data' => $response->get_error_data(),
				), JSON_PRETTY_PRINT)
			);

			return array(
				'success' => false,
				'message' => $response->get_error_message(),
			);
		}

		$code = (int) \wp_remote_retrieve_response_code($response);
		$body = json_decode(\wp_remote_retrieve_body($response), true);

		if ($code === 200 && !empty($body['success'])) {
			$this->save_license_data(
				\sanitize_text_field($key),
				'active',
				\sanitize_text_field($body['expires_at'] ?? '')
			);
			$this->cache_status('active');

			// Clear PUC cache so it picks up the new key immediately.
			\delete_site_transient('update_plugins');

			return array(
				'success' => true,
				'message' => $body['message'] ?? \__('License activated successfully.', 'productbay-pro'),
			);
		}

		$msg = $body['message'] ?? \__('Activation failed. Please check your license key.', 'productbay-pro');

		ActivityLog::error(
			'License activation failed',
			sprintf('Attempted to activate key. Server response: %s', $msg),
			json_encode(array(
				'http_code' => $code,
				'response' => $body ?: \wp_remote_retrieve_body($response),
			), JSON_PRETTY_PRINT)
		);

		return array(
			'success' => false,
			'message' => $msg,
		);
	}

	/**
	 * Validate the current license key against the server.
	 *
	 * Sends a GET request to the license server's /check endpoint.
	 * Updates local status and cache based on the response.
	 *
	 * @since 1.0.0
	 *
	 * @return array{valid: bool, status: string, expires_at?: string} Validation result.
	 */
	public function validate(): array
	{
		$key = $this->get_key();
		if (!$key) {
			return array('valid' => false, 'status' => 'inactive');
		}

		$url = \add_query_arg(
			array(
				'license_key' => $key,
				'slug' => self::SLUG,
				'domain' => $this->get_domain(),
			),
			self::SERVER_URL . '/check'
		);

		$response = \wp_remote_get($url, array('timeout' => self::TIMEOUT));

		if (\is_wp_error($response)) {
			ActivityLog::error(
				'License validation error (Network)',
				sprintf('Could not reach license server for validation: %s', $response->get_error_message()),
				json_encode(array(
					'error_code' => $response->get_error_code(),
					'message' => $response->get_error_message(),
				), JSON_PRETTY_PRINT)
			);
			// Server unreachable — apply grace period.
			return $this->handle_grace_period();
		}

		$body = json_decode(\wp_remote_retrieve_body($response), true);

		if (!is_array($body)) {
			ActivityLog::error(
				'License validation error (Invalid Response)',
				'Received unparsable response from license server.',
				\wp_remote_retrieve_body($response)
			);

			// Cannot parse response cleanly, likely server error page. Apply grace period.
			return $this->handle_grace_period();
		}

		if (!empty($body['success']) && ($body['license'] ?? '') === 'valid') {
			$this->update_status('active', \sanitize_text_field($body['expires_at'] ?? ''));
			$this->cache_status('active');

			return array(
				'valid' => true,
				'status' => 'active',
				'expires_at' => $body['expires_at'] ?? '',
			);
		}

		// License invalid, expired, or revoked.
		$status = $body['license'] ?? 'invalid';
		$old_status = $this->get_status();

		$this->update_status($status);
		$this->cache_status($status);

		if ($old_status === 'active' && $status !== 'active') {
			ActivityLog::warning(
				'License status changed',
				sprintf('Pro license status changed from "active" to "%s". Premium features may be restricted.', $status)
			);
		}

		return array('valid' => false, 'status' => $status);
	}

	/**
	 * Check if the license is currently valid.
	 *
	 * Uses the transient cache to avoid hitting the server on every call.
	 * Falls back to a full validation if the cache is stale.
	 *
	 * @since 1.0.0
	 *
	 * @return bool True if the license is active.
	 */
	public function is_valid(): bool
	{
		$cached = \get_transient(self::TRANSIENT_KEY);
		if (false !== $cached) {
			return 'active' === $cached;
		}

		$result = $this->validate();
		return $result['valid'];
	}

	/**
	 * Get the stored license key.
	 *
	 * @since 1.0.0
	 *
	 * @return string The raw license key or empty string.
	 */
	public function get_key(): string
	{
		$data = $this->get_license_data();
		return $data['key'];
	}

	/**
	 * Get the current license status.
	 *
	 * @since 1.0.0
	 *
	 * @return string One of: active, expired, invalid, inactive.
	 */
	public function get_status(): string
	{
		$data = $this->get_license_data();
		return $data['status'];
	}

	/**
	 * Get the license expiry date.
	 *
	 * @since 1.0.0
	 *
	 * @return string Date string or empty.
	 */
	public function get_expires(): string
	{
		$data = $this->get_license_data();
		return $data['expires'];
	}

	/**
	 * Get a masked version of the license key for display.
	 *
	 * Shows the first 4 and last 4 characters with bullets in between.
	 *
	 * @since 1.0.0
	 *
	 * @return string Masked key or empty string.
	 */
	public function get_masked_key(): string
	{
		$key = $this->get_key();
		$len = strlen($key);

		if ($len <= 8) {
			return $key ? str_repeat('•', $len) : '';
		}

		return substr($key, 0, 4) . str_repeat('•', $len - 8) . substr($key, -4);
	}

	/**
	 * Remove all license data from this site.
	 *
	 * Does NOT deactivate on the server — the activation slot
	 * remains consumed until manual revocation on the server.
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	public function remove(): void
	{
		\delete_option(Config::OPT_LICENSE);
		\delete_option(Config::OPT_LICENSE_KEY);
		\delete_option(Config::OPT_LICENSE_STATUS);
		\delete_option(Config::OPT_LICENSE_EXPIRES);

		\delete_transient(self::TRANSIENT_KEY);
		\delete_site_transient('update_plugins');
	}

	/**
	 * Get the site domain for activation tracking.
	 *
	 * @since 1.0.0
	 *
	 * @return string The site's domain (e.g., "example.com").
	 */
	private function get_domain(): string
	{
		return (string) \wp_parse_url(\home_url(), PHP_URL_HOST);
	}

	/**
	 * Cache the license status in a transient.
	 *
	 * @since 1.0.0
	 *
	 * @param string $status The status to cache.
	 * @return void
	 */
	private function cache_status(string $status): void
	{
		\set_transient(self::TRANSIENT_KEY, $status, self::CACHE_TTL);
	}

	/**
	 * Handle the grace period when the license server is unreachable.
	 *
	 * If the last known status was "active", grant a grace period
	 * so the plugin doesn't falsely report an invalid license
	 * during temporary server outages.
	 *
	 * @since 1.0.0
	 *
	 * @return array{valid: bool, status: string} Grace period result.
	 */
	private function handle_grace_period(): array
	{
		$last_status = $this->get_status();

		if ('active' === $last_status) {
			\set_transient(self::TRANSIENT_KEY, 'active', self::GRACE_TTL);
			return array('valid' => true, 'status' => 'active');
		}

		return array('valid' => false, 'status' => $last_status);
	}

	/**
	 * Get unified license data.
	 */
	private function get_license_data(): array
	{
		$data = \get_option(Config::OPT_LICENSE);
		if (is_array($data)) {
			return $data;
		}

		// Fallback to legacy options
		$legacy_key = \get_option(Config::OPT_LICENSE_KEY, '');

		if ($legacy_key) {
			$data = array(
				'key' => $legacy_key,
				'status' => \get_option(Config::OPT_LICENSE_STATUS, 'inactive'),
				'expires' => \get_option(Config::OPT_LICENSE_EXPIRES, ''),
			);
			\update_option(Config::OPT_LICENSE, $data);

			// Clean up legacy options
			\delete_option(Config::OPT_LICENSE_KEY);
			\delete_option(Config::OPT_LICENSE_STATUS);
			\delete_option(Config::OPT_LICENSE_EXPIRES);

			return $data;
		}

		return array(
			'key' => '',
			'status' => 'inactive',
			'expires' => '',
		);
	}

	/**
	 * Save unified license data.
	 */
	private function save_license_data(string $key, string $status, string $expires): void
	{
		$data = array(
			'key' => $key,
			'status' => $status,
			'expires' => $expires,
		);
		\update_option(Config::OPT_LICENSE, $data);
	}

	/**
	 * Update status/expires only.
	 */
	private function update_status(string $status, string $expires = ''): void
	{
		$data = $this->get_license_data();
		$data['status'] = $status;
		if ($expires !== '') {
			$data['expires'] = $expires;
		}
		\update_option(Config::OPT_LICENSE, $data);
	}

	/**
	 * Cron validation callback.
	 */
	public static function cron_validate(): void
	{
		$client = new self();
		$client->validate();
	}
}
