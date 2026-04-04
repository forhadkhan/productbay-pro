import domReady from '@wordpress/dom-ready';
import PriceFilterFill from './slots/PriceFilterSlot';
import VariationsSlot from './slots/VariationsSlot';
import CustomFieldsSlot from './slots/CustomFieldsSlot';
import ImportExportSlot from './slots/ImportExportSlot';

domReady(() => {
    // If the free plugin exposes useExtensionStore, register our Fill
    const store = (window as any).productbay?.useExtensionStore;
    if (store) {
        store.getState().addFill(PriceFilterFill);
        store.getState().addFill(VariationsSlot);
        store.getState().addFill(CustomFieldsSlot);
        store.getState().addFill(ImportExportSlot);
    }
});
