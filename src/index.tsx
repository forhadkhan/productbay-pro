import domReady from '@wordpress/dom-ready';
import LicenseTab from './slots/LicenseTab';
import LicenseBanner from './slots/LicenseBanner';
import PriceFilterFill from './slots/PriceFilterSlot';
import CustomFieldsSlot from './slots/CustomFieldsSlot';
import ImportExportSlot from './slots/ImportExportSlot';

domReady(() => {
    // If the free plugin exposes useExtensionStore, register our Fill
    const store = (window as any).productbay?.useExtensionStore;
    if (store) {
        store.getState().addFill(PriceFilterFill);
        store.getState().addFill(CustomFieldsSlot);
        store.getState().addFill(ImportExportSlot);
        store.getState().addFill(LicenseBanner);
        store.getState().addFill(LicenseTab);
    }
});
