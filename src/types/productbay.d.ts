/**
 * Global ProductBay Typings
 *
 * This file declares the global `window.productbay` object provided by the Free plugin,
 * so the Pro plugin has type access to exposed stores and UI components.
 */

declare global {
	interface Window {
		productbay: {
			useTableStore: any; // Type as needed later
			useExtensionStore: any; // Type as needed later
			useSettingsStore: any;
			useImportExportStore: any;
			apiFetch: any;
			ui: {
				ProBadge: any;
				ProFeatureGate: any;
				Alert: any;
				Button: any;
				CardRadioGroup: any;
				ColorPicker: any;
				Confetti: any;
				ConfirmButton: any;
				DropdownMenu: any;
				EditableText: any;
				Input: any;
				Modal: any;
				ProductBayIcon: any;
				ProductBayLogo: any;
				Select: any;
				Skeleton: any;
				Stepper: any;
				Tabs: any;
				Toast: any;
				Toaster: any;
				Tooltip: any;
			};
		};

		productBaySettings: {
			apiUrl?: string;
			nonce?: string;
			pluginUrl?: string;
			version?: string;
			isFirstTime?: boolean;
			/** Injected by productbay-pro when active. */
			proActive?: boolean;
			/** Injected by productbay-pro — semver string. */
			proVersion?: string;
			/** Injected by productbay-pro — license data. */
			license?: {
				status: 'active' | 'expired' | 'invalid' | 'inactive';
				isValid: boolean;
				maskedKey: string;
				expiresAt: string;
			};
		};
	}
	
	const productBaySettings: Window['productBaySettings'];
}

export {};
