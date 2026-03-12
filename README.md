<div align="center">
   <a href="https://wpanchorbay.com/products/productbay">
      <img src="https://s6.imgcdn.dev/YSNRBn.png" alt="ProductBay Logo">
   </a>
</div>
<br />

# ProductBay Pro

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg) ![Status](https://img.shields.io/badge/status-private-red.svg)

**ProductBay Pro** is the premium add-on for the [ProductBay free plugin](https://github.com/forhadkhan/productbay). It unlocks advanced features for WooCommerce product tables, including pro-exclusive column types, advanced filtering, export capabilities, and deeper design customization.

> **Note:** This repository is private and available only to paying customers.

## Architecture & Extensibility

ProductBay Pro uses a **hook-based architecture**. It does not duplicate any code from the free version, nor does it interact with the WordPress database directly. 

Instead, it extends the free version entirely via WordPress action hooks (`do_action`) and filters (`apply_filters`).

- **Free plugin**: Defines the core experience, database schema, and UI, while exposing `productbay_*` extension points.
- **Pro plugin**: Acts purely as an add-on, injecting premium features into those extension points.

For a complete reference of available hooks, see the [ProductBay Hooks API Documentation](https://forhadkhan.github.io/productbay/developer/hooks).

## Development Setup

### Prerequisites

1. **WordPress Local Development Environment**
2. **ProductBay (Free)** — installed and active from the [public repo](https://github.com/forhadkhan/productbay/releases/latest/).
3. **Composer** v2+ for PHP dependencies
4. **Bun** (or npm/Yarn) for release scripting

### Setup Instructions

1. **Clone the Repository**
   Clone this repo into your `wp-content/plugins/` directory, alongside the free version:
   ```bash
   cd wp-content/plugins
   git clone git@github.com:forhadkhan/productbay-pro.git
   cd productbay-pro
   ```

2. **Install PHP Dependencies**    
   The pro plugin uses Composer for PSR-4 autoloading.
   ```bash
   composer install
   ```

3. **Install Build Scripts**
   ```bash
   bun install
   ```

*(Note: Unlike the free version, there is no `bun run dev` step needed here, as the Pro version currently does not compile React/Tailwind assets independently. All React UI extensions are injected into the free version's localized script data.)*

## 📦 Building for Production

To create a production-ready ZIP file for distribution:

1. Install production dependencies (no dev tooling):
   ```bash
   composer install --no-dev --optimize-autoloader
   ```

2. Package the release:
   ```bash
   bun run release
   ```
   
   This will generate `productbay-pro.zip` and `productbay-pro-X.X.X.zip` in the `dist/` directory, stripped of all dev/testing files.

## License & Copyright

**Copyright:** [WPAnchorBay](https://wpanchorbay.com/) (2026). All rights reserved. Do not distribute.
