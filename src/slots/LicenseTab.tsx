import { ShieldCheckIcon, ShieldAlertIcon, RefreshCwIcon, ExternalLinkIcon, Trash2Icon, KeyIcon } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { PRO_ROUTES, API_ENDPOINTS } from '@/utils/constants';
import { Fill } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const { Button, Input, ConfirmButton } = (window as any).productbay?.ui || {};
const { SectionHeading } = (window as any).productbay?.components || {};
const apiFetch = (window as any).productbay?.apiFetch;

// Types
interface LicenseState {
	status: 'active' | 'expired' | 'invalid' | 'inactive';
	isValid: boolean;
	maskedKey: string;
	expiresAt: string;
}

/**
 * Parses a string to check if it's a JSON error message.
 * If true, returns the 'message' property from the JSON.
 * Otherwise returns the raw string.
 */
const parseErrorMessage = (error: string): string => {
	try {
		const parsed = JSON.parse(error);
		if (parsed && typeof parsed === 'object' && parsed.message) {
			return parsed.message;
		}
	} catch (e) {
		// Not JSON, return as is
	}
	return error;
};

const LicenseTab = () => {
	const [license, setLicense] = useState<LicenseState | null>(null);
	const [loading, setLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState(false);
	const [inputKey, setInputKey] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);

	// Fetch current status on mount
	const fetchStatus = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await apiFetch(API_ENDPOINTS.LICENSE, { method: 'GET' });
			setLicense(data as LicenseState);
		} catch (err: any) {
			setError(parseErrorMessage(err.message || __('Failed to load license status.', 'productbay-pro')));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (apiFetch) {
			fetchStatus();
		} else {
			setLoading(false);
			setError(__('API client not available. Please ensure ProductBay free is up to date.', 'productbay-pro'));
		}
	}, [fetchStatus]);

	// Handle activation
	const handleActivate = async () => {
		if (!inputKey.trim()) {
			setError(__('Please enter a license key.', 'productbay-pro'));
			return;
		}

		setActionLoading(true);
		setError(null);
		setSuccessMsg(null);

		try {
			const res: any = await apiFetch(API_ENDPOINTS.LICENSE, {
				method: 'POST',
				body: JSON.stringify({ license_key: inputKey.trim() })
			});

			setSuccessMsg(res.message || __('License activated successfully.', 'productbay-pro'));
			setInputKey('');

			// Refresh state
			await fetchStatus();

			// Also update the global object so banner hides immediately
			if (window.productBaySettings && window.productBaySettings.license) {
				window.productBaySettings.license.status = 'active';
			}

			// Reload page after a delay to ensure everything is synchronized 
			setTimeout(() => {
				window.location.reload();
			}, 1500);

		} catch (err: any) {
			setError(parseErrorMessage(err.message || __('Activation failed.', 'productbay-pro')));
		} finally {
			setActionLoading(false);
		}
	};

	// Handle removal
	const handleRemove = async () => {
		setActionLoading(true);
		setError(null);
		setSuccessMsg(null);

		try {
			const res: any = await apiFetch(API_ENDPOINTS.LICENSE, { method: 'DELETE' });
			setSuccessMsg(res.message || __('License removed.', 'productbay-pro'));

			// Refresh state
			await fetchStatus();

			if (window.productBaySettings && window.productBaySettings.license) {
				window.productBaySettings.license.status = 'inactive';
			}

			setTimeout(() => {
				window.location.reload();
			}, 1500);

		} catch (err: any) {
			setError(parseErrorMessage(err.message || __('Failed to remove license.', 'productbay-pro')));
		} finally {
			setActionLoading(false);
		}
	};

	if (!SectionHeading) {
		return null;
	}

	return (
		<Fill name="productbay-pro-settings-license">
			<section className="space-y-6 p-6">
				<SectionHeading
					title={__('ProductBay Pro License', 'productbay-pro')}
					description={__('Manage your license key to receive automatic updates and premium support.', 'productbay-pro')}
				/>

				<div className="bg-white rounded-lg p-6">

					{/* Loading State */}
					{loading ? (
						<div className="flex items-center space-x-3 text-gray-500">
							<RefreshCwIcon className="w-5 h-5 animate-spin" />
							<span>{__('Checking license status...', 'productbay-pro')}</span>
						</div>
					) : (
						<div className="space-y-6">

							{/* Feedback Messages */}
							{error && (
								<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
									{error}
								</div>
							)}
							{successMsg && (
								<div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
									{successMsg}
								</div>
							)}

							{/* Active/Expired State */}
							{license && (license.status === 'active' || license.status === 'expired') ? (
								<div className="space-y-4">
									<div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
										<div className="flex items-center gap-3">
											{license.status === 'active' ? (
												<div className="w-12 h-12 bg-[#f05c2a]/10 flex items-center justify-center rounded-full shrink-0">
													<ShieldCheckIcon className="w-6 h-6 text-[#f05c2a]" />
												</div>
											) : (
												<div className="w-12 h-12 bg-amber-100 flex items-center justify-center rounded-full shrink-0">
													<ShieldAlertIcon className="w-6 h-6 text-amber-600" />
												</div>
											)}
											<div>
												<h3 className="font-medium text-gray-900">
													{license.status === 'active' ? __('License Active', 'productbay-pro') : __('License Expired', 'productbay-pro')}
												</h3>
												<p className="text-sm text-gray-500 font-mono mt-1">
													{license.maskedKey}
												</p>
											</div>
										</div>

										<div className="text-right">
											<div className={`text-sm font-medium ${license.status === 'active' ? 'text-green-600' : 'text-amber-600'}`}>
												{license.status === 'active' ? __('Valid', 'productbay-pro') : __('Expired', 'productbay-pro')}
											</div>
											{license.expiresAt && (
												<p className="text-xs text-gray-500 mt-1">
													{license.status === 'active' ? __('Expires:', 'productbay-pro') : __('Expired on:', 'productbay-pro')} {new Date(license.expiresAt).toLocaleDateString()}
												</p>
											)}
										</div>
									</div>

									<div className="flex gap-3 pt-2 justify-end">
										{ConfirmButton && (
											<ConfirmButton
												confirmMessage={__('Are you sure you want to remove this license? You will no longer receive updates.', 'productbay-pro')}
												onConfirm={handleRemove}
												variant="outline"
												className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
												disabled={actionLoading}
												icon={<Trash2Icon className="w-4 h-4 mr-2" />}
											>
												{__('Remove License', 'productbay-pro')}
											</ConfirmButton>
										)}

										{license.status === 'expired' && (
											<a
												href={PRO_ROUTES.ACCOUNT}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
											>
												{__('Renew License', 'productbay-pro')}
												<ExternalLinkIcon className="w-4 h-4 ml-2" />
											</a>
										)}
									</div>
								</div>
							) : (
								/* Inactive/Invalid State */
								<div className="space-y-4">
									<p className="text-sm text-gray-600 mb-2">
										{__('Enter your license key below to activate ProductBay Pro and enable automatic updates.', 'productbay-pro')}
									</p>

									<div className="flex gap-3 max-w-md">
										{Input && (
											<Input
												type="password"
												placeholder="WPAB-XXXX-XXXX-XXXX-XXXX"
												value={inputKey}
												onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputKey(e.target.value)}
												className="flex-1"
												disabled={actionLoading}
											/>
										)}
										{Button && (
											<Button
												variant="default"
												onClick={handleActivate}
												disabled={actionLoading || !inputKey.trim()}
											>
												{actionLoading ? (
													<RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
												) : (
													<KeyIcon className="w-4 h-4 mr-2" />
												)}
												{__('Activate', 'productbay-pro')}
											</Button>
										)}
									</div>

									<div className="pt-4 border-t border-gray-100 mt-6">
										<p className="text-sm text-gray-500">
											{__('Don\'t have a license? ', 'productbay-pro')}
											<a
												href={PRO_ROUTES.LEARN_MORE}
												target="_blank"
												rel="noopener noreferrer"
												className="text-blue-600 hover:underline underline-offset-4 inline-flex items-center"
											>
												{__('Get ProductBay Pro', 'productbay-pro')}
												<ExternalLinkIcon className="w-3 h-3 ml-1" />
											</a>
										</p>
									</div>
								</div>
							)}

						</div>
					)}
				</div>
			</section>
		</Fill>
	);
};

export default LicenseTab;
