import React, { useState, useEffect, useMemo } from 'react';
import { Fill } from '@wordpress/components';
import { BoltIcon, PackageIcon, SearchIcon, SparklesIcon, StoreIcon, X } from 'lucide-react';
import { Select } from '@/components/ui';
import { __ } from '@wordpress/i18n';
import { cn } from '@/utils/cn';

/**
 * MetaKeyEntry Interface
 *
 * Defines the structure of an individual meta key object returned by the Pro API.
 * These represent database keys like '_price', 'product_brand', etc.
 */
interface MetaKeyEntry {
    /** The raw database key string. */
    key: string;
    /** Human-readable name for the field (e.g. "Regular Price"). */
    label: string;
    /** The expected data type (e.g. "number", "text", "image"). */
    type: string;
    /** Parent group name, used specifically to categorize ACF fields into their Field Groups. */
    group?: string;
}

/**
 * MetaKeysResponse Interface
 *
 * The shape of the JSON response from the `productbay/v1/pro/meta-keys` endpoint.
 * Data is pre-grouped by the backend into common logical sources.
 */
interface MetaKeysResponse {
    /** Product meta registered by WooCommerce core. */
    woocommerce: MetaKeyEntry[];
    /** Custom fields discovered from Advanced Custom Fields plugin. */
    acf: MetaKeyEntry[];
    /** Random or unhandled meta keys found in the postmeta table. */
    custom: MetaKeyEntry[];
}

/**
 * Available display formats for Custom Field columns.
 * These options allow users to hint how the raw meta value should be rendered on the frontend.
 */
const DISPLAY_FORMATS = [
    { value: 'auto', label: __('Auto Detect', 'productbay-pro') },
    { value: 'text', label: __('Plain Text', 'productbay-pro') },
    { value: 'number', label: __('Number', 'productbay-pro') },
    { value: 'date', label: __('Date', 'productbay-pro') },
    { value: 'image', label: __('Image', 'productbay-pro') },
    { value: 'link', label: __('Link / URL', 'productbay-pro') },
    { value: 'boolean', label: __('Yes / No Badge', 'productbay-pro') },
];

/**
 * Human-readable mapping for meta key group identifiers.
 */
const GROUP_LABELS: Record<string, string> = {
    woocommerce: __('WooCommerce', 'productbay-pro'),
    acf: __('Advanced Custom Fields', 'productbay-pro'),
    custom: __('Custom Meta', 'productbay-pro'),
};

/**
 * CustomFieldsSlot Component
 *
 * This is the entry point for the Pro-only Custom Field settings.
 * It uses the WordPress `Fill` component to "inject" itself into the `productbay-pro-cf-settings`
 * slot defined in the Free plugin's `ColumnItem.tsx`.
 *
 * IMPORTANT: It uses the function-as-child pattern to receive `fillProps` from the Slot.
 * These props include the current `column` object and the `onUpdate` dispatcher.
 */
const CustomFieldsSlot = () => {
    return (
        <Fill name="productbay-pro-cf-settings">
            {(fillProps: any) => <CustomFieldsPanel {...fillProps} />}
        </Fill>
    );
};

/**
 * useMetaKeys Hook
 *
 * A specialized state management hook for the Advanced Meta Selector.
 * Handles:
 * 1. Async fetching of meta keys from the WP REST API.
 * 2. Search input state and debounced query syncing.
 * 3. Client-side filtering of results across all groups.
 *
 * @returns {Object} State and setters for the meta selector UI.
 */
const useMetaKeys = () => {
    const [metaKeys, setMetaKeys] = useState<MetaKeysResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');      // Raw typing value (fast)
    const [searchQuery, setSearchQuery] = useState('');     // Debounced value (slow, used for filtering)
    const [error, setError] = useState<string | null>(null);

    /**
     * Debounce the search input to prevent expensive filtering/re-renders
     * on every single keystroke.
     */
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(inputValue);
        }, 300);
        return () => clearTimeout(timer);
    }, [inputValue]);

    /**
     * Fetch all available meta keys from the server.
     * This happens only once when the first CF column is expanded.
     */
    useEffect(() => {
        const fetchMetaKeys = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Settings are localized via PHP in Includes/Pro/Assets.php
                const settings = (window as any).productBaySettings || {};
                const apiUrl = settings.apiUrl;
                const endpoint = apiUrl ? `${apiUrl}pro/meta-keys` : '/wp-json/productbay/v1/pro/meta-keys';
                const nonce = settings.nonce || (window as any).wpApiSettings?.nonce || '';

                const response = await fetch(endpoint, {
                    headers: { 'X-WP-Nonce': nonce },
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                setMetaKeys(data);
            } catch (err) {
                setError(__('Failed to load meta keys.', 'productbay-pro'));
                console.error('ProductBay Pro: Failed to fetch meta keys:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMetaKeys();
    }, []);

    /**
     * Compute the filtered list of meta keys based on the debounced search query.
     * Searches against key, label, and ACF group names.
     */
    const filteredKeys = useMemo(() => {
        if (!metaKeys) return null;

        const query = searchQuery.toLowerCase().trim();
        if (!query) return metaKeys;

        const filterGroup = (group: MetaKeyEntry[]) =>
            group.filter(
                (entry) =>
                    entry.key.toLowerCase().includes(query) ||
                    entry.label.toLowerCase().includes(query) ||
                    (entry.group && entry.group.toLowerCase().includes(query))
            );

        return {
            woocommerce: filterGroup(metaKeys.woocommerce),
            acf: filterGroup(metaKeys.acf),
            custom: filterGroup(metaKeys.custom),
        };
    }, [metaKeys, searchQuery]);

    /** Calculate total visibility count for the "Matched Results" indicator. */
    const totalResults = filteredKeys
        ? filteredKeys.woocommerce.length + filteredKeys.acf.length + filteredKeys.custom.length
        : 0;

    return {
        metaKeys,
        isLoading,
        error,
        inputValue,
        setInputValue,
        searchQuery,
        filteredKeys,
        totalResults,
    };
};

/**
 * CustomFieldsPanel Component
 *
 * The actual UI rendered inside the Slot. It provides:
 * 1. A search-and-browse interface for meta keys.
 * 2. A selection status indicator.
 * 3. A display format dropdown.
 *
 * @param {Object} props Props injected by the Slot via Fill function-child.
 */
const CustomFieldsPanel: React.FC<{
    column: any;                        // The store object for the current column being edited.
    onUpdate: (updates: any) => void;   // Redux-style action dispatcher from the core plugin.
}> = ({ column, onUpdate }) => {
    const {
        isLoading,
        error,
        inputValue,
        setInputValue,
        searchQuery,
        filteredKeys,
        totalResults,
    } = useMetaKeys();

    // Sync UI with the column settings in the parent Store
    const selectedKey = column.settings?.metaKey || '';
    const selectedFormat = column.settings?.displayFormat || 'auto';

    /**
     * Persist selection to the global store.
     * This instantly updates the "Meta Key (Manual Override)" input in the parent ColumnItem.
     */
    const handleMetaKeySelect = (key: string) => {
        onUpdate({
            settings: {
                ...column.settings,
                metaKey: key,
            },
        });
    };

    /**
     * Persist formatting choice to the global store.
     */
    const handleFormatChange = (format: string) => {
        onUpdate({
            settings: {
                ...column.settings,
                displayFormat: format,
            },
        });
    };

    /**
     * Renders a specific group of meta keys (WC, ACF, or Custom).
     * ACF groups are rendered with an additional nesting layer for "Field Groups".
     */
    const renderGroup = (
        groupKey: string,
        entries: MetaKeyEntry[],
    ) => {
        if (entries.length === 0) return null;

        // ACF fields require sub-grouping by their 'group' property for better organization
        if (groupKey === 'acf') {
            const subGroups: Record<string, MetaKeyEntry[]> = {};
            entries.forEach((entry) => {
                const group = entry.group || __('Ungrouped', 'productbay-pro');
                if (!subGroups[group]) subGroups[group] = [];
                subGroups[group].push(entry);
            });

            return (
                <div key={groupKey} className="mb-4">
                    <div className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-2 flex items-center gap-1.5 px-1 py-0.5 bg-purple-50 rounded-sm">
                        <SparklesIcon className="w-4 h-4 text-purple-600" />
                        {GROUP_LABELS[groupKey]}
                    </div>
                    <div className="space-y-4">
                        {Object.entries(subGroups).map(([subGroupName, subEntries]) => (
                            <div key={subGroupName} className="ml-1 pl-3 border-l-2 border-purple-100">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-200" />
                                    {subGroupName}
                                </div>
                                <div className="space-y-0.5">
                                    {subEntries.map((entry) => (
                                        <MetaKeyButton
                                            key={entry.key}
                                            entry={entry}
                                            isSelected={selectedKey === entry.key}
                                            onClick={() => handleMetaKeySelect(entry.key)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // Standard icon mapping for common groups
        const groupIcons: Record<string, any> = {
            woocommerce: <StoreIcon className="w-4 h-4 text-blue-600" />,
            custom: <BoltIcon className="w-4 h-4 text-gray-600" />,
        };

        const groupStyles: Record<string, string> = {
            woocommerce: 'text-blue-700 bg-blue-50',
            custom: 'text-gray-700 bg-gray-50',
        };

        return (
            <div key={groupKey} className="mb-4">
                <div className={cn(
                    "text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 px-1 py-0.5 rounded-sm",
                    groupStyles[groupKey] || 'text-gray-600 bg-gray-100'
                )}>
                    <span>{groupIcons[groupKey] || '📦'}</span>
                    {GROUP_LABELS[groupKey]}
                </div>
                <div className="space-y-0.5">
                    {entries.map((entry) => (
                        <MetaKeyButton
                            key={entry.key}
                            entry={entry}
                            isSelected={selectedKey === entry.key}
                            onClick={() => handleMetaKeySelect(entry.key)}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-3 bg-white rounded-lg p-3 border border-gray-200 mt-2">
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-widest">
                    {__('Advanced Meta Selector', 'productbay-pro')}
                </span>
            </div>

            <p className="text-xs text-gray-500 m-0 leading-relaxed">
                {__('Browse all available product meta keys. Click any key to instantly use it.', 'productbay-pro')}
            </p>

            {/* Meta Key Search Input */}
            <div className="relative group">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={__('Search meta keys…', 'productbay-pro')}
                    className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-100 transition-all font-medium"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                    {inputValue ? (
                        <button
                            onClick={() => setInputValue('')}
                            className="cursor-pointer p-0.5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
                            title={__('Clear search', 'productbay-pro')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    ) : (
                        <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                    )}
                </div>
            </div>

            {/* Global Highlight for the currently active key */}
            {selectedKey && (
                <div className="flex items-center gap-2 px-2 py-1 px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-md">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-tight">
                        {__('Active Key:', 'productbay-pro')}
                    </span>
                    <code className="text-[11px] font-bold text-blue-700 truncate font-mono">
                        {selectedKey}
                    </code>
                </div>
            )}

            {/* Skeleton / Pulse Loading State */}
            {isLoading && (
                <div className="space-y-2 animate-pulse pr-1">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-8 bg-gray-100 rounded-md" />
                    ))}
                </div>
            )}

            {/* Results Match Metadata */}
            {searchQuery && !isLoading && totalResults > 0 && (
                <div className="flex items-center justify-between px-1 border-b border-gray-100 pb-1.5 pt-0.5">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        {__('Matched Results', 'productbay-pro')}
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                        {totalResults}
                    </span>
                </div>
            )}

            {/* Backend / Network Error Handling */}
            {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md p-2.5 font-medium animate-in fade-in">
                    {error}
                </div>
            )}

            {/* Scrollable meta key list with categorized groups */}
            {filteredKeys && !isLoading && (
                <div className="max-h-72 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {totalResults === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                            <div className="p-3 bg-white rounded-full mb-3">
                                <SearchIcon className="w-6 h-6 text-gray-300" />
                            </div>
                            <div className="font-bold text-gray-600 text-sm">
                                {searchQuery
                                    ? __('Key not found', 'productbay-pro')
                                    : __('No meta keys available', 'productbay-pro')}
                            </div>
                            {searchQuery && (
                                <div className="text-xs text-gray-400 mt-1 max-w-[200px] leading-relaxed mx-auto">
                                    {__('Try searching for something else or manually enter a key below.', 'productbay-pro')}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {renderGroup('woocommerce', filteredKeys.woocommerce)}
                            {renderGroup('acf', filteredKeys.acf)}
                            {renderGroup('custom', filteredKeys.custom)}
                        </>
                    )}
                </div>
            )}

            {/* Display Formatting Settings */}
            <div className="pt-2 border-t border-gray-100 mt-2">
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        {__('Formatting Mode', 'productbay-pro')}
                    </label>
                    <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-tighter",
                        selectedFormat === 'auto' ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                    )}>
                        {selectedFormat === 'auto' ? __('Smart Mode', 'productbay-pro') : __('Standard', 'productbay-pro')}
                    </span>
                </div>
                <Select
                    className="w-full h-9 text-sm"
                    value={selectedFormat}
                    onChange={handleFormatChange}
                    options={DISPLAY_FORMATS}
                />
                <p className="text-[11px] text-gray-400 mt-2 m-0 leading-relaxed italic">
                    {__('Auto Detect intelligently renders links, images, and dates based on their content.', 'productbay-pro')}
                </p>
            </div>
        </div>
    );
};

/**
 * MetaKeyButton Component
 *
 * A specialized interactive button representing a single meta key entry.
 * It shows the human label prominently and the technical key in a mono-font code badge.
 */
const MetaKeyButton: React.FC<{
    entry: MetaKeyEntry;
    isSelected: boolean;
    onClick: () => void;
}> = ({ entry, isSelected, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full flex items-center gap-2 px-2.5 py-1.5 text-xs border border-transparent rounded-lg text-left group/btn relative overflow-hidden',
                isSelected
                    ? 'bg-blue-200 text-blue-700 border-blue-300'
                    : 'bg-white hover:bg-blue-100 text-gray-700 hover:text-blue-700 hover:border-blue-100'
            )}
            title={`${entry.key} (${entry.type})`}
        >
            <span className={cn(
                "flex-1 truncate font-semibold text-gray-800"
            )}>
                {entry.label}
            </span>
            <code className={cn(
                "flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold",
                isSelected
                    ? "bg-blue-500 text-blue-50 border border-blue-400"
                    : "bg-gray-100 text-gray-400 border border-gray-200 group-hover/btn:bg-blue-100 group-hover/btn:text-blue-500 group-hover/btn:border-blue-200"
            )}>
                {entry.key}
            </code>
        </button>
    );
};

export default CustomFieldsSlot;
