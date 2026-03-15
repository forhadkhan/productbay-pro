/**
 * Proxy Exporter for Global ProductBay UI Components
 *
 * This file allows the Pro plugin to import UI components symmetrically
 * to the Free plugin (e.g., `import { Button } from '@/components/ui'`)
 * without actually bundling them into the Pro payload.
 */

export const {
	Alert,
	Button,
	CardRadioGroup,
	ColorPicker,
	Confetti,
	ConfirmButton,
	DropdownMenu,
	EditableText,
	Input,
	Modal,
	ProductBayIcon,
	ProductBayLogo,
	Select,
	Skeleton,
	Stepper,
	Tabs,
	Toast,
	Toaster,
	Toggle,
	Tooltip,
} = (window as any).productbay?.ui || {};
