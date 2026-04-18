/**
 * Central constants for ProductBay Pro.
 *
 * Contains all configuration values, API endpoints, and external URLs.
 * Update values here instead of scattered files.
 */

export const PRO_CONFIG = {
	VERSION: '1.0.0',
	SLUG: 'productbay-pro',
} as const;

export const API_ENDPOINTS = {
	LICENSE: 'pro/license',
	EXPORT: 'pro/export',
	IMPORT: 'pro/import',
	META_KEYS: 'pro/meta-keys',
} as const;

export const REST_NAMESPACE = 'productbay/v1';

export const EXTERNAL_URLS = {
	ACCOUNT: 'https://wpanchorbay.com/my-account',
	PURCHASE: 'https://wpanchorbay.com/product/productbay/',
	LEARN_MORE: 'https://wpanchorbay.com/plugins/productbay/',
	DOCS: 'https://wpanchorbay.com/docs/productbay/',
	SUPPORT: 'https://wpanchorbay.com/support/',
	LICENSE_SERVER: 'https://wpanchorbay.com/wp-json/license-server/v1',
} as const;

export const LICENSE_TAB_HASH = '#/settings?tab=license';

export const PRO_ROUTES = {
	ACCOUNT: EXTERNAL_URLS.ACCOUNT,
	PURCHASE: EXTERNAL_URLS.PURCHASE,
	LEARN_MORE: EXTERNAL_URLS.LEARN_MORE,
	DOCS: EXTERNAL_URLS.DOCS,
	SUPPORT: EXTERNAL_URLS.SUPPORT,
	LICENSE_TAB: LICENSE_TAB_HASH,
} as const;
