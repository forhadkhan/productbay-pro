=== ProductBay Pro ===
Contributors: wpanchorbay, forhadkhan
Tags: woocommerce product table, product table, product list, woocommerce, bulk add to cart
Requires at least: 6.0
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

High-performance WooCommerce product tables with instant AJAX search, flexible filters, and a guided React-powered creation wizard.

== Description ==

**ProductBay Pro requires WooCommerce and ProductBay (Free) to be installed and active.**

ProductBay Pro is a premium add-on that unlocks the full potential of your WooCommerce product tables. It extends the core functionality of ProductBay (Free) with advanced features designed for high-conversion stores.

### Pro Features:
* **Advanced Filtering:** Enable price range sliders and custom attribute filters for faster product discovery.
* **Pro Column Types:** Unlock exclusive columns like "Stock Status", "SKU", and "Product Attributes".
* **Variable Product Support:** Enhanced handling for variable products with inline variation selectors.
* **Direct AJAX Add-to-Cart:** Streamlined checkout process without page reloads.
* **Export Capabilities:** Allow users to export table data to CSV or Print (coming soon).
* **Deep Customization:** Access advanced design controls for typography, colors, and layout spacing.
* **Priority Support:** Get faster response times from our dedicated support team.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/productbay-pro`, or install directly through the WordPress Plugins screen.
2. Activate the plugin through the **Plugins** screen in WordPress.
3. Ensure WooCommerce and ProductBay (Free) are installed and active.
4. Navigate to **ProductBay** in the WordPress admin menu — Pro features will be automatically enabled in the creation wizard.
5. Copy the generated shortcode (e.g. `[productbay id="1"]`) and paste it into any page, post, or widget.

== Frequently Asked Questions ==

= Does this plugin require WooCommerce? =

Yes. ProductBay Pro is a WooCommerce extension and will not function without WooCommerce installed and active.

= Does this plugin require ProductBay (Free)? =

Yes. ProductBay Pro is a ProductBay (Free) extension and will not function without ProductBay (Free) installed and active.

= Which product types are supported? =

ProductBay Pro supports WooCommerce Simple, Variable, Grouped, and External/Affiliate (view only) product types.

= How do I display a table on a page? =

After creating a table in the ProductBay dashboard, copy its shortcode — for example `[productbay id="1"]` — and paste it into any page, post, or block using the Shortcode block.

= Can I display multiple tables on the same page? =

Yes. Each table has its own scoped CSS, so multiple tables on the same page will not conflict with each other's styling.

= Does this plugin call any external services? =

No. All JavaScript, CSS, and other assets are bundled locally within the plugin. No data is sent to any external server.

= Will it slow down my site? =

ProductBay is built with performance in mind. Assets are loaded only on pages where a table shortcode is present, and product queries are cached for 30 minutes to minimize database load.

= Is it translation ready? =

Yes. All user-facing strings use WordPress localization functions and the plugin is 100% translation ready.

= Where can I get support? =

As a Pro customer, you have access to priority support. Please visit our [Support Center](https://wpanchorbay.com/support) or email your query to support@wpanchorbay.com. We typically respond within 1 business day.

== Screenshots ==

1. The ProductBay dashboard showing all created tables with status and shortcode information.
2. Step 1 of the creation wizard — table setup and product source selection.
3. The column editor with drag-and-drop reordering and responsive visibility controls.
4. The design customization panel with live preview.
5. A product table on the front end with inline variation selectors and AJAX add-to-cart.

== Changelog ==

= 1.0.0 =
* Initial release of ProductBay Pro.
* Added advanced filtering support (Price Filter).
* Added Pro slots and extensibility points for the ProductBay.

== Upgrade Notice ==

= 1.0.0 =
Initial release — no upgrade steps required.