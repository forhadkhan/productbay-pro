import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fill } from '@wordpress/components';
import { SearchIcon, X } from 'lucide-react';
import { Select } from '@/components/ui';
import { __ } from '@wordpress/i18n';
import { cn } from '@/utils/cn';

/**
 * Meta key entry returned from the REST API.
 */
interface MetaKeyEntry {
    key: string;
    label: string;
    type: string;
    group?: string;
}

/**
 * Grouped meta keys response from the API.
 */
interface MetaKeysResponse {
    woocommerce: MetaKeyEntry[];
    acf: MetaKeyEntry[];
    custom: MetaKeyEntry[];
}

/**
 * Display format options for custom field values.
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

// TYPE_ICONS removed for cleaner layout

/**
 * Group labels for display.
 */
const GROUP_LABELS: Record<string, string> = {
    woocommerce: __('WooCommerce', 'productbay-pro'),
    acf: __('Advanced Custom Fields', 'productbay-pro'),
    custom: __('Custom Meta', 'productbay-pro'),
};

/**
 * CustomFieldsSlot Component
 *
 * Fills the `productbay-pro-cf-settings` slot in ColumnItem.tsx with an
 * advanced meta-key selector featuring search, grouping, and format selection.
 */
const CustomFieldsSlot = () => {
    const useTableStore = (window as any).productbay?.useTableStore;

    if (!useTableStore) {
        return null;
    }

    return (
        <Fill name="productbay-pro-cf-settings">
            <CustomFieldsPanel />
        </Fill>
    );
};

/**
 * The actual panel component rendered inside the Fill.
 * Separated to keep hooks at the top level of a component.
 */
const CustomFieldsPanel = () => {
    const useTableStore = (window as any).productbay?.useTableStore;

    const columns = useTableStore?.((state: any) => state.columns) || [];
    const updateColumn = useTableStore?.((state: any) => state.updateColumn);

    // Find the currently expanded cf column.
    // We get the column that triggered this Fill render by looking at
    // which cf column is currently in the DOM context.
    // Since the Slot renders inside ColumnItem for each cf column,
    // we need to identify which one. We use a simple approach: find the
    // nearest cf column by checking DOM context or use all cf columns.
    const [metaKeys, setMetaKeys] = useState<MetaKeysResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [selectedFormat, setSelectedFormat] = useState('auto');
    const selectRef = useRef<HTMLDivElement>(null);

    /**
     * Lazy search: Debounce input changes.
     */
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(inputValue);
        }, 300);
        return () => clearTimeout(timer);
    }, [inputValue]);

    /**
     * Fetch meta keys from the Pro REST endpoint.
     */
    useEffect(() => {
        const fetchMetaKeys = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const settings = (window as any).productBaySettings || {};
                const apiUrl = settings.apiUrl;
                const endpoint = apiUrl ? `${apiUrl}pro/meta-keys` : '/wp-json/productbay/v1/pro/meta-keys';
                const nonce = settings.nonce || (window as any).wpApiSettings?.nonce || '';

                const response = await fetch(
                    endpoint,
                    {
                        headers: {
                            'X-WP-Nonce': nonce,
                        },
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

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
     * Filter meta keys by search query.
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

    /**
     * Total number of results.
     */
    const totalResults = filteredKeys
        ? filteredKeys.woocommerce.length + filteredKeys.acf.length + filteredKeys.custom.length
        : 0;

    /**
     * Render a grouped list of meta key entries.
     */
    const renderGroup = (
        groupKey: string,
        entries: MetaKeyEntry[],
        onSelect: (key: string) => void,
        selectedKey: string
    ) => {
        if (entries.length === 0) return null;

        // Sub-group ACF entries by their field group.
        if (groupKey === 'acf') {
            const subGroups: Record<string, MetaKeyEntry[]> = {};
            entries.forEach((entry) => {
                const group = entry.group || __('Ungrouped', 'productbay-pro');
                if (!subGroups[group]) subGroups[group] = [];
                subGroups[group].push(entry);
            });

            return (
                <div key={groupKey} className="mb-3">
                    <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                        <span>🔮</span>
                        {GROUP_LABELS[groupKey]}
                    </div>
                    {Object.entries(subGroups).map(([subGroupName, subEntries]) => (
                        <div key={subGroupName} className="ml-2 mb-2">
                            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
                                {subGroupName}
                            </div>
                            {subEntries.map((entry) => (
                                <MetaKeyButton
                                    key={entry.key}
                                    entry={entry}
                                    isSelected={selectedKey === entry.key}
                                    onClick={() => onSelect(entry.key)}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            );
        }

        const groupIcons: Record<string, string> = {
            woocommerce: '🛒',
            custom: '⚙️',
        };

        return (
            <div key={groupKey} className="mb-3">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span>{groupIcons[groupKey] || '📦'}</span>
                    {GROUP_LABELS[groupKey]}
                </div>
                <div className="space-y-0.5">
                    {entries.map((entry) => (
                        <MetaKeyButton
                            key={entry.key}
                            entry={entry}
                            isSelected={selectedKey === entry.key}
                            onClick={() => onSelect(entry.key)}
                        />
                    ))}
                </div>
            </div>
        );
    };

    // Since this Fill renders for ALL cf columns simultaneously (the Slot is inside
    // each ColumnItem), we render a self-contained panel. Each cf column gets its own
    // instance of this panel because the Slot is inside the per-column expanded section.
    //
    // However, the Fill doesn't receive the column context directly. We need to get
    // the current column from a parent DOM context or use a different approach.
    //
    // Approach: Render a component that manages its own selection state and syncs
    // with the store. Since we can't know which column triggered this render,
    // we render a meta-key selector that is "global" — users browse and copy a key.
    //
    // Better approach for v1: Render an enhanced picker panel that works alongside
    // the existing free text input. Users can browse keys here and click to populate.

    return (
        <div className="space-y-3 bg-white rounded-lg p-3 border border-gray-200 mt-2">
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                    {__('Advanced Meta Selector', 'productbay-pro')}
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                    PRO
                </span>
            </div>

            <p className="text-xs text-gray-500 m-0">
                {__('Browse all available product meta keys. Click to use a key in the field below.', 'productbay-pro')}
            </p>

            {/* Search Input */}
            <div className="relative group">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={__('Search meta keys…', 'productbay-pro')}
                    className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-all"
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

            {/* Loading State */}
            {isLoading && (
                <div className="space-y-2 animate-pulse">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-7 bg-gray-200 rounded" />
                    ))}
                </div>
            )}

            {/* Results Count Info */}
            {searchQuery && !isLoading && totalResults > 0 && (
                <div className="flex items-center justify-between px-1 border-b border-gray-200">
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                        {__('Search Results', 'productbay-pro')}
                    </span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">
                        {totalResults}
                    </span>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                    {error}
                </div>
            )}

            {/* Meta Key List */}
            {filteredKeys && !isLoading && (
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {totalResults === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                            <div className="text-2xl mb-2">
                                <SearchIcon className="w-6 h-6 text-gray-400 pointer-events-none" />
                            </div>
                            <div className="font-semibold text-gray-600">
                                {searchQuery
                                    ? __('Not found any matching keys.', 'productbay-pro')
                                    : __('No meta keys found.', 'productbay-pro')}
                            </div>
                            {searchQuery && (
                                <div className="text-xs text-gray-400 mt-1">
                                    {__('Try a different search term or browse the categories.', 'productbay-pro')}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {renderGroup('woocommerce', filteredKeys.woocommerce, handleMetaKeyClick, '')}
                            {renderGroup('acf', filteredKeys.acf, handleMetaKeyClick, '')}
                            {renderGroup('custom', filteredKeys.custom, handleMetaKeyClick, '')}
                        </>
                    )}
                </div>
            )}

            {/* Display Format Selector */}
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    {__('Display Format', 'productbay-pro')}
                    <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded font-medium">
                        PRO
                    </span>
                </label>
                <div ref={selectRef}>
                    <Select
                        className="w-full"
                        value={selectedFormat}
                        onChange={(val: string) => {
                            setSelectedFormat(val);
                            const event = new CustomEvent('productbay-pro-cf-format', {
                                bubbles: true,
                                detail: { format: val },
                            });
                            selectRef.current?.dispatchEvent(event);
                        }}
                        options={DISPLAY_FORMATS}
                    />
                </div>
                <p className="text-[11px] text-gray-400 mt-1 m-0">
                    {__('Auto Detect intelligently formats URLs as links, image IDs as images, and dates as formatted dates.', 'productbay-pro')}
                </p>
            </div>
        </div>
    );
};

/**
 * handleMetaKeyClick — Populate the meta key input above this panel.
 *
 * Since the Fill doesn't get column props directly, we use a DOM approach:
 * find the sibling input[placeholder*="meta"] and set its value + trigger onChange.
 */
function handleMetaKeyClick(key: string) {
    // Find the closest cf settings container and the meta key input within it.
    // The Slot renders inside .space-y-3 alongside the free meta key input.
    const activeSlot = document.querySelector('[data-slot-name="productbay-pro-cf-settings"]')
        ?.closest('.space-y-3');

    if (!activeSlot) {
        // Fallback: find any visible meta key input.
        const inputs = document.querySelectorAll<HTMLInputElement>(
            'input[placeholder*="meta"], input[placeholder*="_weight"]'
        );
        if (inputs.length > 0) {
            setNativeValue(inputs[inputs.length - 1], key);
        }
        return;
    }

    const input = activeSlot.querySelector<HTMLInputElement>('input[type="text"]');
    if (input) {
        setNativeValue(input, key);
    }
}

/**
 * Set a React-controlled input's value by triggering proper React events.
 */
function setNativeValue(input: HTMLInputElement, value: string) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
    )?.set;

    if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Focus the input to give visual feedback.
    input.focus();
    input.select();
}

/**
 * Individual meta key button component.
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
                'w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors text-left',
                'hover:bg-blue-50 hover:text-blue-700',
                isSelected
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-white border border-transparent text-gray-700'
            )}
            title={`${entry.key} (${entry.type})`}
        >
            <span className="flex-1 truncate font-medium pl-1">{entry.label}</span>
            <code className="flex-shrink-0 text-[10px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded font-mono">
                {entry.key}
            </code>
        </button>
    );
};

export default CustomFieldsSlot;
