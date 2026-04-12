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
		$response = $this->resilient_request('POST', '/activate', array(
			'headers' => array('Content-Type' => 'application/json'),
			'body' => \wp_json_encode(array(
				'license_key' => $key,
				'slug' => self::SLUG,
				'domain' => $this->get_domain(),
			)),
		));

		if (\is_wp_error($response)) {
			return array(
				'success' => false,
				'message' => $this->friendly_connection_error($response),
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
			sprintf("Attempted to activate key. Server response: %s\n%s", $msg, (string) json_encode(array(
				'http_code' => $code,
				'response' => $body ?: \wp_remote_retrieve_body($response),
			), JSON_PRETTY_PRINT))
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

		$query = \http_build_query(array(
			'license_key' => $key,
			'slug' => self::SLUG,
			'domain' => $this->get_domain(),
		));

		$response = $this->resilient_request('GET', '/check?' . $query);

		if (\is_wp_error($response)) {
			// Server unreachable — keep current status, user can retry later.
			return array('valid' => false, 'status' => $this->get_status());
		}

		$body = json_decode(\wp_remote_retrieve_body($response), true);

		if (!is_array($body)) {
			ActivityLog::error(
				'License validation error (Invalid Response)',
				'Received unparsable response from license server.' . "\n" . \wp_remote_retrieve_body($response)
			);

			// Cannot parse response cleanly — keep current status, user can retry later.
			return array('valid' => false, 'status' => $this->get_status());
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
		$status = \sanitize_text_field($body['license'] ?? 'invalid');
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

	// ------------------------------------------------------------------
	// Resilient HTTP transport
	// ------------------------------------------------------------------

	/**
	 * Perform a resilient HTTP request with automatic fallback strategies.
	 *
	 * Tries multiple connection strategies in order to work around
	 * common hosting restrictions (outdated CA bundles, cURL misconfiguration).
	 *
	 * Strategy order:
	 *  1. Normal request (domain + full SSL verification).
	 *  2. SSL-relaxed request (sslverify=false) — fixes outdated CA bundles.
	 *
	 * Once a strategy succeeds, it is cached so subsequent requests
	 * skip straight to the working strategy (cache: 12 hours).
	 *
	 * @since 1.0.0
	 *
	 * @param string $method HTTP method: 'GET' or 'POST'.
	 * @param string $endpoint The API endpoint path (e.g. '/activate').
	 * @param array  $extra_args Extra wp_remote_* arguments (headers, body, etc.).
	 * @return array|\WP_Error The raw wp_remote response or final WP_Error.
	 */
	private function resilient_request(string $method, string $endpoint, array $extra_args = array())
	{
		$strategies = $this->build_strategies($endpoint, $extra_args);
		$preferred = \get_transient('productbay_pro_conn_strategy');

		// If we have a known-good strategy, try it first.
		if ($preferred && isset($strategies[$preferred])) {
			$first = $strategies[$preferred];
			unset($strategies[$preferred]);
			$strategies = array($preferred => $first) + $strategies;
		}

		$last_error = null;
		$errors_log = array();

		foreach ($strategies as $name => $config) {
			$url = $config['url'];
			$args = array_merge(
				array('timeout' => self::TIMEOUT),
				$extra_args,
				$config['args'] ?? array()
			);

			$response = ('POST' === $method)
				? \wp_remote_post($url, $args)
				: \wp_remote_get($url, $args);

			if (!\is_wp_error($response)) {
				$http_code = (int) \wp_remote_retrieve_response_code($response);

				// Any real HTTP response (even 4xx / 5xx) means connectivity works.
				if ($http_code > 0) {
					// Remember this strategy for future requests.
					if ($preferred !== $name) {
						\set_transient('productbay_pro_conn_strategy', $name, 12 * HOUR_IN_SECONDS);
					}
					return $response;
				}
			}

			// Log this failure for diagnostics.
			$err_msg = \is_wp_error($response) ? $response->get_error_message() : 'Empty HTTP response';
			$errors_log[$name] = $err_msg;
			$last_error = $response;
		}

		// All strategies failed. Clear the cached strategy so next
		// attempt starts fresh.
		\delete_transient('productbay_pro_conn_strategy');

		// Log the full diagnostics.
		ActivityLog::error(
			'License server unreachable (all strategies failed)',
			'Could not connect to the license server after trying all available connection methods.' . "\n" .
			(string) json_encode($errors_log, JSON_PRETTY_PRINT)
		);

		return \is_wp_error($last_error)
			? $last_error
			: new \WP_Error('connection_failed', \__('Unable to connect to the license server.', 'productbay-pro'));
	}

	/**
	 * Build the list of connection strategies.
	 *
	 * @since 1.0.0
	 *
	 * @param string $endpoint   API endpoint path.
	 * @param array  $extra_args Additional request arguments.
	 * @return array<string, array{url: string, args: array}> Named strategies.
	 */
	private function build_strategies(string $endpoint, array $extra_args): array
	{
		$domain_url = self::SERVER_URL . $endpoint;

		$strategies = array();

		// Strategy 1: Normal — domain + verified SSL (most secure).
		$strategies['normal'] = array(
			'url' => $domain_url,
			'args' => array(),
		);

		// Strategy 2: SSL-relaxed — domain but skip CA verification.
		// Fixes servers with outdated CA certificate bundles.
		$strategies['ssl_relaxed'] = array(
			'url' => $domain_url,
			'args' => array('sslverify' => false),
		);

		return $strategies;
	}

	/**
	 * Generate a user-friendly error message when connection fails.
	 *
	 * @since 1.0.0
	 *
	 * @param \WP_Error $error The WordPress error from the HTTP request.
	 * @return string Friendly message for display to the user.
	 */
	private function friendly_connection_error(\WP_Error $error): string
	{
		$raw = $error->get_error_message();

		// phpcs:disable WordPress.WP.I18n.NonSingularStringLiteralText -- Long user-facing messages.

		// Detect common cURL error patterns.
		if (
			stripos($raw, 'cURL error 7') !== false
			|| stripos($raw, 'cURL error 28') !== false
			|| stripos($raw, "Couldn't connect") !== false
			|| stripos($raw, 'timed out') !== false
			|| stripos($raw, 'Connection refused') !== false
		) {
			// phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText
			return \__('Could not connect to the license server. This is usually caused by your hosting provider blocking outgoing connections. Please ask your host to allow outgoing HTTPS requests to wpanchorbay.com, or try again later.', 'productbay-pro');
		}

		if (
			stripos($raw, 'cURL error 60') !== false
			|| stripos($raw, 'cURL error 35') !== false
			|| stripos($raw, 'SSL') !== false
		) {
			// phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText
			return \__('SSL certificate verification failed when connecting to the license server. This is usually caused by an outdated server configuration. Please ask your hosting provider to update the CA certificate bundle.', 'productbay-pro');
		}

		if (
			stripos($raw, 'cURL error 6') !== false
			|| stripos($raw, 'resolve host') !== false
		) {
			// phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText
			return \__('Could not resolve the license server address. This may be a temporary DNS issue. Please try again in a few minutes, or ask your hosting provider to check DNS resolution.', 'productbay-pro');
		}

		// phpcs:enable WordPress.WP.I18n.NonSingularStringLiteralText

		// Generic fallback.
		return sprintf(
			/* translators: %s: technical error message */
			\__('License server communication error: %s', 'productbay-pro'),
			$raw
		);
	}

	// ------------------------------------------------------------------
	// Private helpers
	// ------------------------------------------------------------------

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
