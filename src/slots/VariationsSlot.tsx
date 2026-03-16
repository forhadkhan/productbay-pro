import React from 'react';
import { cn } from '@/utils/cn';
import { __ } from '@wordpress/i18n';
import { Fill } from '@wordpress/components';
import { Select } from '@/components/ui';
import SectionHeading from '@/components/Table/SectionHeading';
import { SettingsOption } from '@/components/Table/SettingsOption';

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
 * VariationsSlot component
 * 
 * Renders the Variations Config into the 'productbay-pro-options' slot.
 */
const VariationsSlot = () => {
    // Access the global store hook exposed by the Free plugin
    const useTableStore = (window as any).productbay?.useTableStore;

    if (!useTableStore) {
        return null;
    }

    const { settings, setFeatures } = useTableStore();
    const configMode = settings?.features?.variationsMode || 'inline';

    return (
        <Fill name="productbay-pro-options">
            <SettingsSection
                title={__('Variable & Grouped Products (Pro)', 'productbay-pro')}
                description={__('Configure how complex products are displayed in the table', 'productbay-pro')}
            >
                <SettingsOption
                    title={__('Display Mode', 'productbay-pro')}
                    description={__('Choose how variations and grouped child products are shown', 'productbay-pro')}
                >
                    <Select
                        value={configMode}
                        onChange={(value: string) => setFeatures({
                            variationsMode: value
                        })}
                        options={[
                            { label: __('Inline (Default)', 'productbay-pro'), value: 'inline' },
                            { label: __('Popup Modal', 'productbay-pro'), value: 'popup' },
                            { label: __('Nested Rows', 'productbay-pro'), value: 'nested' }
                        ]}
                        className="w-60"
                    />
                </SettingsOption>
            </SettingsSection>
        </Fill>
    );
};

export default VariationsSlot;
