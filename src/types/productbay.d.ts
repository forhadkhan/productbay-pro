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
			ui: {
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
				Toggle: any;
				Tooltip: any;
			};
		};
	}
}

export {};
