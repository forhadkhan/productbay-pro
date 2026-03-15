import React from 'react';
import { cn } from '@/utils/cn';
import { __ } from '@wordpress/i18n';
import { Fill } from '@wordpress/components';
import { Toggle } from '@/components/ui/Toggle';
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
 * PriceFilterFill component
 * 
 * This component renders the Price Filter settings into the 'productbay-pro-options' slot.
 */
const PriceFilterFill = () => {
    // Access the global store hook exposed by the Free plugin
    const useTableStore = (window as any).productbay?.useTableStore;

    if (!useTableStore) {
        return null;
    }

    const { settings, setFeatures } = useTableStore();

    // Default config if not present
    const config = settings?.features?.priceFilter || {
        enabled: false,
        mode: 'both',
        step: 1
    };

    return (
        <Fill name="productbay-pro-options">
            <SettingsSection
                title={__('Price Range Filter (Pro)', 'productbay-pro')}
                description={__('Configure frontend price filtering options', 'productbay-pro')}
            >
                {/* Enable Toggle */}
                <SettingsOption
                    title={__('Enable Price Filter', 'productbay-pro')}
                    description={__('Show a price range slider/input in the table toolbar', 'productbay-pro')}
                >
                    <Toggle
                        checked={!!config.enabled}
                        onChange={(e) => setFeatures({
                            priceFilter: { ...config, enabled: e.target.checked }
                        })}
                    />
                </SettingsOption>

                {/* Sub-options */}
                <div className={cn(
                    "transition-all duration-300 space-y-2",
                    config.enabled ? "opacity-100" : "opacity-40 pointer-events-none grayscale"
                )}>
                    {/* Mode Selector */}
                    <SettingsOption
                        title={__('Filter Mode', 'productbay-pro')}
                        description={__('Choose between range slider, numeric inputs, or both', 'productbay-pro')}
                    >
                        <select
                            value={config.mode || 'both'}
                            onChange={(e) => setFeatures({
                                priceFilter: { ...config, mode: e.target.value }
                            })}
                            className="w-40 h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                            <option value="slider">{__('Slider Only', 'productbay-pro')}</option>
                            <option value="input">{__('Inputs Only', 'productbay-pro')}</option>
                            <option value="both">{__('Both (Slider + Inputs)', 'productbay-pro')}</option>
                        </select>
                    </SettingsOption>

                    {/* Step Value */}
                    <SettingsOption
                        title={__('Filter Step', 'productbay-pro')}
                        description={__('Increment value for slider and inputs', 'productbay-pro')}
                    >
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={config.step || 1}
                            onChange={(e) => setFeatures({
                                priceFilter: { ...config, step: parseFloat(e.target.value) || 1 }
                            })}
                            className="w-24 h-9 px-3 py-2 text-center border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                    </SettingsOption>

                    {/* Custom Minimum Price */}
                    <SettingsOption
                        title={__('Custom Minimum Price', 'productbay-pro')}
                        description={__('Leave empty to auto-detect from products', 'productbay-pro')}
                    >
                        <input
                            type="number"
                            min="0"
                            placeholder="Auto"
                            value={config.customMin ?? ''}
                            onChange={(e) => setFeatures({
                                priceFilter: { ...config, customMin: e.target.value === '' ? null : parseFloat(e.target.value) }
                            })}
                            className="w-24 h-9 px-3 py-2 text-center border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                    </SettingsOption>

                    {/* Custom Maximum Price */}
                    <SettingsOption
                        title={__('Custom Maximum Price', 'productbay-pro')}
                        description={__('Leave empty to auto-detect from products', 'productbay-pro')}
                    >
                        <input
                            type="number"
                            min="0"
                            placeholder="Auto"
                            value={config.customMax ?? ''}
                            onChange={(e) => setFeatures({
                                priceFilter: { ...config, customMax: e.target.value === '' ? null : parseFloat(e.target.value) }
                            })}
                            className="w-24 h-9 px-3 py-2 text-center border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                    </SettingsOption>
                </div>
            </SettingsSection>
        </Fill>
    );
};

export default PriceFilterFill;
