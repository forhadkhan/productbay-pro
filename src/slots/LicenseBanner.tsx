import { __ } from '@wordpress/i18n';
import { Fill } from '@wordpress/components';
import { PRO_ROUTES } from '@/utils/constants';
import { ShieldAlertIcon, KeyIcon } from 'lucide-react';

const { Button } = (window as any).productbay?.ui || {};

/**
 * LicenseBanner component
 * 
 * Injects a persistent banner into the free plugin's AdminLayout if the Pro
 * license is missing, expired, or invalid. Disappears completely when active.
 */
const LicenseBanner = () => {
	const license = window.productBaySettings?.license;
	const status = license?.status || 'inactive';

	// If license is active, banner disappears completely
	if (status === 'active') {
		return null;
	}

	const handleGoToSettings = () => {
		// Navigate to the license tab
		window.location.hash = PRO_ROUTES.LICENSE_TAB;
	};

	let bannerConfig: any = {
		bgClass: 'bg-amber-50 border-b border-amber-200 text-amber-800',
		icon: <ShieldAlertIcon className="w-5 h-5 text-amber-600" />,
		title: __('License Required', 'productbay-pro'),
		message: __('Activate your ProductBay Pro license to receive automatic updates and premium support.', 'productbay-pro'),
		buttonText: __('Activate License', 'productbay-pro'),
		buttonVariant: 'default' as const,
	};

	if (status === 'expired') {
		bannerConfig = {
			bgClass: 'bg-amber-50 border-b border-amber-200 text-amber-800',
			icon: <ShieldAlertIcon className="w-5 h-5 text-amber-600" />,
			title: __('License Expired', 'productbay-pro'),
			message: __('Your ProductBay Pro license has expired. Renew to continue receiving updates.', 'productbay-pro'),
			buttonText: __('Renew License', 'productbay-pro'),
			buttonVariant: 'default' as const,
		};
	} else if (status === 'invalid') {
		bannerConfig = {
			bgClass: 'bg-red-50 border-b border-red-200 text-red-800',
			icon: <KeyIcon className="w-5 h-5 text-red-600" />,
			title: __('License Invalid', 'productbay-pro'),
			message: __('Your ProductBay Pro license key is invalid or has been revoked.', 'productbay-pro'),
			buttonText: __('Check License', 'productbay-pro'),
			buttonVariant: 'destructive' as const,
		};
	}

	return (
		<Fill name="productbay-pro-banner">
			<div className={`w-full px-6 py-3 flex items-center justify-between shadow-sm ${bannerConfig.bgClass}`}>
				<div className="flex items-center gap-3 text-base">
					{bannerConfig.icon}
					<div>
						<strong className="font-semibold block sm:inline mr-2">
							{bannerConfig.title}:
						</strong>
						<span className="">{bannerConfig.message}</span>
					</div>
				</div>
				<div>
					{Button && (
						<Button
							variant={bannerConfig.buttonVariant}
							size="sm"
							onClick={handleGoToSettings}
							className="whitespace-nowrap cursor-pointer"
						>
							{bannerConfig.buttonText}
						</Button>
					)}
				</div>
			</div>
		</Fill>
	);
};

export default LicenseBanner;
