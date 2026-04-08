import React from 'react';
import { __ } from '@wordpress/i18n';
import { Fill } from '@wordpress/components';
import { Select, Toggle } from '@/components/ui';

const { SectionHeading, SettingsOption } = (window as any).productbay?.components || {};

/**
 * SettingsSection Component (Internal Helper shadowed from Free)
 */
interface SettingsSectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
}

const SettingsSection = ({
    title,
    description,
    children
}: SettingsSectionProps) => (
    <section className="space-y-6 pt-8 border-t border-gray-100 mt-8">
        <SectionHeading
            title={title}
            description={description}
        />
        <div className="space-y-2">
            {children}
        </div>
    </section>
);

/**
 * Display mode options for variable products.
 * Variable products support inline (attribute dropdowns), popup, nested, and separate modes.
 */
const variableModeOptions = [
    { label: __('Inline Dropdown', 'productbay-pro'), value: 'inline' },
    { label: __('Popup Modal', 'productbay-pro'), value: 'popup' },
    { label: __('Nested Rows', 'productbay-pro'), value: 'nested' },
    { label: __('Separate Rows', 'productbay-pro'), value: 'separate' },
];

/**
 * Display mode options for grouped products.
 * Grouped products support inline (child product dropdown), popup, nested, and separate modes.
 */
const groupedModeOptions = [
    { label: __('Inline Dropdown', 'productbay-pro'), value: 'inline' },
    { label: __('Popup Modal', 'productbay-pro'), value: 'popup' },
    { label: __('Nested Rows', 'productbay-pro'), value: 'nested' },
    { label: __('Separate Rows', 'productbay-pro'), value: 'separate' },
];

/**
 * VariationsSlot component
 *
 * Renders the Variable & Grouped Products configuration into the 'productbay-pro-options' slot.
 * Provides separate display mode selectors for variable and grouped products, plus controls
 * for nested row behavior and product subtitle display.
 *
 * Settings are persisted via the tableStore and applied in the PHP VariationsModule
 * using the productbay_cell_output and productbay_after_row hooks.
 */
const VariationsSlot = () => {
    // Access the global store hook exposed by the Free plugin
    const useTableStore = (window as any).productbay?.useTableStore;

    if (!useTableStore) {
        return null;
    }

    const { settings, setFeatures } = useTableStore();
    const features = settings?.features || {};

    // Read new per-type settings with fallback to legacy variationsMode
    const variableMode = features.variableProductMode || features.variationsMode || 'inline';
    const groupedMode = features.groupedProductMode || (features.variationsMode !== 'inline' ? features.variationsMode : 'popup') || 'popup';
    const nestedExpanded = features.nestedDefaultExpanded ?? false;
    const showChildCount = features.showChildCount ?? true;

    // Check if either mode uses nested to show the expand toggle
    const hasNestedMode = variableMode === 'nested' || groupedMode === 'nested';

    return (
        <Fill name="productbay-pro-options">
            <SettingsSection
                title={__('Variable & Grouped Products (Pro)', 'productbay-pro')}
                description={__('Configure how complex products are displayed in the table', 'productbay-pro')}
            >
                <SettingsOption
                    title={__('Variable Products', 'productbay-pro')}
                    description={__('Products with attribute-based variations (e.g., size, color)', 'productbay-pro')}
                >
                    <Select
                        value={variableMode}
                        onChange={(value: string) => setFeatures({
                            variableProductMode: value,
                            // Sync legacy key for backward compatibility
                            variationsMode: value,
                        })}
                        options={variableModeOptions}
                        className="w-60"
                    />
                </SettingsOption>

                <SettingsOption
                    title={__('Grouped Products', 'productbay-pro')}
                    description={__('Products containing multiple child simple products', 'productbay-pro')}
                >
                    <Select
                        value={groupedMode}
                        onChange={(value: string) => setFeatures({
                            groupedProductMode: value,
                        })}
                        options={groupedModeOptions}
                        className="w-60"
                    />
                </SettingsOption>

                {/* Only show the nested expand toggle when at least one type uses nested mode */}
                {hasNestedMode && (
                    <SettingsOption
                        title={__('Expand Nested Rows', 'productbay-pro')}
                        description={__('Show nested rows expanded by default instead of collapsed', 'productbay-pro')}
                    >
                        <Toggle
                            checked={nestedExpanded}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFeatures({
                                nestedDefaultExpanded: e.target.checked,
                            })}
                        />
                    </SettingsOption>
                )}

                <SettingsOption
                    title={__('Show Options Count', 'productbay-pro')}
                    description={__('Display "X options available" subtitle below product name', 'productbay-pro')}
                >
                    <Toggle
                        checked={showChildCount}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFeatures({
                            showChildCount: e.target.checked,
                        })}
                    />
                </SettingsOption>
            </SettingsSection>
        </Fill>
    );
};

export default VariationsSlot;
