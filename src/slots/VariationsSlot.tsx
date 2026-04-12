import React from 'react';

/**
 * VariationsSlot component
 *
 * This slot was previously used to inject Variable & Grouped Products 
 * configuration from the Pro plugin. This logic has now been migrated 
 * to the core free plugin's OptionsPanel.tsx to support the free 
 * 'inline' grouped product mode.
 * 
 * We return null here to avoid rendering duplicate settings.
 */
const VariationsSlot = () => {
    return null;
};

export default VariationsSlot;
