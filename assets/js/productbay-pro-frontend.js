(function ($) {
	'use strict';

	class ProductBayPriceFilter {
		constructor(wrapper) {
			this.$wrapper = $(wrapper);
			this.$filter = this.$wrapper.find('.productbay-price-filter');
			if (!this.$filter.length) return;

			this.tableId = this.$wrapper.data('table-id');
			this.mode = this.$filter.data('mode') || 'both';
			this.minBound = parseFloat(this.$filter.data('min') || 0);
			this.maxBound = parseFloat(this.$filter.data('max') || 1000);
			this.step = parseFloat(this.$filter.data('step') || 1);

			// Slider Elements
			this.$sliderWrap = this.$filter.find('.productbay-price-slider-wrap');
			this.$rangeMin = this.$filter.find('.productbay-price-range-min');
			this.$rangeMax = this.$filter.find('.productbay-price-range-max');
			this.$trackFill = this.$filter.find('.productbay-price-slider-track-fill');
			this.$tooltipMin = this.$filter.find('.productbay-price-tooltip-min');
			this.$tooltipMax = this.$filter.find('.productbay-price-tooltip-max');

			// Input Elements
			this.$inputMin = this.$filter.find('.productbay-price-input-min');
			this.$inputMax = this.$filter.find('.productbay-price-input-max');

			this.init();
		}

		init() {
			this.bindEvents();
			this.updateUI();
		}

		bindEvents() {
			// Slider events
			if (this.$rangeMin.length) {
				this.$rangeMin.on('input', (e) => {
					let val = parseFloat(e.target.value);
					if (val >= parseFloat(this.$rangeMax.val())) {
						val = parseFloat(this.$rangeMax.val()) - this.step;
						this.$rangeMin.val(val);
					}
					this.updateUI();
				});
				this.$rangeMin.on('change', () => this.triggerFilter());
			}

			if (this.$rangeMax.length) {
				this.$rangeMax.on('input', (e) => {
					let val = parseFloat(e.target.value);
					if (val <= parseFloat(this.$rangeMin.val())) {
						val = parseFloat(this.$rangeMin.val()) + this.step;
						this.$rangeMax.val(val);
					}
					this.updateUI();
				});
				this.$rangeMax.on('change', () => this.triggerFilter());
			}

			// Input events
			if (this.$inputMin.length) {
				this.$inputMin.on('change', (e) => {
					let val = parseFloat(e.target.value);
					if (isNaN(val) || val < this.minBound) val = this.minBound;
					if (val > parseFloat(this.$inputMax.val()) - this.step) {
						val = parseFloat(this.$inputMax.val()) - this.step;
					}
					this.$inputMin.val(val);
					this.syncToSliders();
					this.updateUI();
					this.triggerFilter();
				});
			}

			if (this.$inputMax.length) {
				this.$inputMax.on('change', (e) => {
					let val = parseFloat(e.target.value);
					if (isNaN(val) || val > this.maxBound) val = this.maxBound;
					if (val < parseFloat(this.$inputMin.val()) + this.step) {
						val = parseFloat(this.$inputMin.val()) + this.step;
					}
					this.$inputMax.val(val);
					this.syncToSliders();
					this.updateUI();
					this.triggerFilter();
				});
			}

			// Listen for global filter clear
			this.$wrapper.on('click', '.productbay-filters-clear', () => {
				this.reset();
			});

			// Listen for programmatic price reset (from free plugin's handleFiltersClear)
			this.$filter.on('productbay_price_reset', () => {
				this.reset();
				this.updateUI();
			});
		}

		syncToSliders() {
			if (this.$rangeMin.length) this.$rangeMin.val(this.$inputMin.val());
			if (this.$rangeMax.length) this.$rangeMax.val(this.$inputMax.val());
		}

		updateUI() {
			const minVal = parseFloat(this.$rangeMin.length ? this.$rangeMin.val() : this.$inputMin.val());
			const maxVal = parseFloat(this.$rangeMax.length ? this.$rangeMax.val() : this.$inputMax.val());

			// Update inputs if they exist
			if (this.$inputMin.length && document.activeElement !== this.$inputMin[0]) this.$inputMin.val(minVal);
			if (this.$inputMax.length && document.activeElement !== this.$inputMax[0]) this.$inputMax.val(maxVal);

			// Update slider track and tooltips
			if (this.$sliderWrap.length) {
				const minPercent = ((minVal - this.minBound) / (this.maxBound - this.minBound)) * 100;
				const maxPercent = ((maxVal - this.minBound) / (this.maxBound - this.minBound)) * 100;

				this.$trackFill.css({
					left: minPercent + '%',
					width: (maxPercent - minPercent) + '%'
				});

				if (this.$tooltipMin.length) {
					this.$tooltipMin.text(this.formatPrice(minVal)).css('left', `calc(${minPercent}% + ${8 - minPercent * 0.16}px)`);
				}
				if (this.$tooltipMax.length) {
					this.$tooltipMax.text(this.formatPrice(maxVal)).css('left', `calc(${maxPercent}% + ${8 - maxPercent * 0.16}px)`);
				}
			}
		}

		formatPrice(amount) {
			if (window.productbay_frontend && typeof window.productbay_frontend.formatPrice === 'function') {
				return window.productbay_frontend.formatPrice(amount);
			}
			// Fallback
			return '$' + parseFloat(amount).toFixed(2);
		}

		triggerFilter() {
			this.$wrapper.trigger('productbay_filter_trigger', {
				price_min: this.$rangeMin.length ? this.$rangeMin.val() : this.$inputMin.val(),
				price_max: this.$rangeMax.length ? this.$rangeMax.val() : this.$inputMax.val()
			});
		}

		reset() {
			if (this.$rangeMin.length) this.$rangeMin.val(this.minBound);
			if (this.$rangeMax.length) this.$rangeMax.val(this.maxBound);
			if (this.$inputMin.length) this.$inputMin.val(this.minBound);
			if (this.$inputMax.length) this.$inputMax.val(this.maxBound);
			this.updateUI();
		}
	}

	// Initialize on document ready
	$(document).ready(function () {
		$('.productbay-wrapper').each(function () {
			new ProductBayPriceFilter(this);
		});
	});

	/**
	 * ProductBay Pro - Lazy Loading (Load More & Infinite Scroll)
	 */
	class ProductBayProLazyLoading {
		constructor(wrapper) {
			this.$wrapper = window.jQuery(wrapper);
			this.observer = null;
			this.init();
		}

		init() {
			this.bindEvents();
			this.initInfiniteScroll();
		}

		bindEvents() {
			// 1. Load More Button Click
			this.$wrapper.on('click', '.productbay-load-more-btn', (e) => {
				e.preventDefault();
				this.$wrapper.trigger('productbay_next_page');
			});

			// 2. Re-init Infinite Scroll after any AJAX fetch (as pagination container is replaced)
			this.$wrapper.on('productbay_after_fetch', () => {
				this.initInfiniteScroll();
			});
		}

		initInfiniteScroll() {
			const $pagination = this.$wrapper.find('.productbay-pagination');
			const mode = $pagination.data('mode');

			if (mode !== 'infinite') return;

			const sentinel = this.$wrapper.find('.productbay-infinite-sentinel')[0];
			if (!sentinel) return;

			if (this.observer) {
				this.observer.disconnect();
			}

			this.observer = new IntersectionObserver((entries) => {
				if (entries[0].isIntersecting) {
					// Check if already loading. The free plugin adds .loading to search or button.
					const isLoading = this.$wrapper.hasClass('productbay-loading') || 
									this.$wrapper.find('.productbay-load-more-btn').hasClass('loading') ||
									this.$wrapper.find('.productbay-search').hasClass('loading');
					
					if (!isLoading) {
						this.$wrapper.trigger('productbay_next_page');
					}
				}
			}, {
				rootMargin: '200px'
			});

			this.observer.observe(sentinel);
		}
	}

	// Initialize Lazy Loading
	window.jQuery(document).ready(function ($) {
		$('.productbay-wrapper').each(function () {
			new ProductBayProLazyLoading(this);
		});
	});

})(jQuery);

/**
 * ProductBay Pro - Variations Frontend Interactivity
 *
 * Handles popup modal, nested row toggle, separate rows, grouped inline select,
 * quantity +/- delegation, and bulk selection sync with parent table.
 */
document.addEventListener('DOMContentLoaded', () => {

	// ─── Helper: Find parent table's ProductBayTable instance ──────────────────
	function getTableInstance(wrapper) {
		// The free plugin stores instances on the wrapper element via jQuery .data()
		if (window.jQuery && wrapper) {
			const $wrapper = window.jQuery(wrapper);
			// Try to access via the class instance stored by the free plugin
			// The free plugin initializes: new ProductBayTable(wrapper)
			// We can access it via the restoreModalSelections event or selectedProducts map
			return $wrapper;
		}
		return null;
	}

	// ─── 1. Popup Trigger ─────────────────────────────────────────────────────────
	document.body.addEventListener('click', (e) => {
		const target = e.target.closest('.productbay-pro-btn-popup');
		if (!target) return;
		e.preventDefault();

		const productId = target.getAttribute('data-product-id');
		const tableId = target.getAttribute('data-table-id');
		const wrapper = target.closest('.productbay-wrapper');
		if (!wrapper) return;

		const modal = wrapper.parentNode.querySelector('.productbay-pro-variations-modal') || document.querySelector('.productbay-pro-variations-modal');
		if (!modal) return;

		// Move modal into the wrapper so base plugin event delegation (for bulk select) catches the events
		if (modal.parentNode !== wrapper) {
			wrapper.appendChild(modal);
		}

		const content = modal.querySelector('.productbay-pro-variations-inner');
		content.innerHTML = `<p style="padding: 20px; text-align: center;">Loading variations...</p>`;

		// Store the originating wrapper and trigger product ID for later sync
		modal.setAttribute('data-trigger-btn', productId);
		modal.setAttribute('data-wrapper-id', wrapper.id || '');

		modal.showModal();

		// Fetch via AJAX
		const data = new URLSearchParams();
		data.append('action', 'productbay_pro_get_variation_html');
		data.append('product_id', productId);
		data.append('table_id', tableId);
		data.append('mode', 'popup');
		data.append('nonce', productbay_pro_ajax.nonce);

		fetch(productbay_pro_ajax.ajax_url, {
			method: 'POST',
			body: data,
		})
			.then(res => res.json())
			.then(response => {
				if (response.success) {
					content.innerHTML = response.data.html;
					if (window.jQuery) {
						window.jQuery(document.body).trigger('productbay_pro_modal_loaded', [content]);
					}
				} else {
					content.innerHTML = `<p style="color:red; padding: 20px;">Error: ${response.data}</p>`;
				}
			});
	});

	// ─── 2. Add to Cart inside Popup ──────────────────────────────────────────────
	document.body.addEventListener('click', (e) => {
		const btn = e.target.closest('.productbay-pro-popup-add-btn');
		if (!btn) return;
		e.preventDefault();

		if (btn.disabled) return;

		const row = btn.closest('tr');
		const productType = row.getAttribute('data-product-type') || 'variation';
		let productId = row.getAttribute('data-parent-id');
		let variationId = row.getAttribute('data-product-id');

		// If it's a simple child of a grouped product, the product_id IS the row's ID, and variation is 0.
		if (productType === 'simple') {
			productId = row.getAttribute('data-product-id');
			variationId = 0;
		}

		const attrsRaw = row.getAttribute('data-attributes') || '{}';
		const attributes = JSON.parse(attrsRaw);

		const qtyInput = row.querySelector('.productbay-qty');
		const quantity = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;

		const originalText = btn.innerHTML;
		btn.innerHTML = 'Adding...';
		btn.disabled = true;

		const $ = window.jQuery;
		if (!$) {
			console.error('jQuery not loaded');
			return;
		}

		$.ajax({
			url: window.productbay_frontend.ajaxurl,
			type: 'POST',
			data: {
				action: 'productbay_bulk_add_to_cart',
				nonce: window.productbay_frontend.nonce,
				items: [{
					product_id: productId,
					quantity: quantity,
					variation_id: variationId || 0,
					attributes: attributes || {}
				}]
			},
			success: (response) => {
				if (response.success) {
					btn.innerHTML = 'Added ✓';
					// trigger WC fragments refresh
					$(document.body).trigger('wc_fragment_refresh');

					try {
						// Show message inside popup
						const msgArea = btn.closest('.productbay-pro-variations-modal')?.querySelector('.productbay-pro-popup-message');
						if (msgArea) {
							msgArea.innerHTML = `<div>Added ${quantity} to cart successfully!</div>`;
							setTimeout(() => { if (msgArea) msgArea.innerHTML = ''; }, 3000);
						}

						// Optional: Update the trigger button's message area outside the modal
						const modalElement = btn.closest('.productbay-pro-variations-modal');
						if (modalElement) {
							const triggerId = modalElement.getAttribute('data-trigger-btn');
							if (triggerId) {
								const triggerBtn = document.querySelector(`.productbay-pro-btn-popup[data-product-id="${triggerId}"]`);
								if (triggerBtn) {
									const triggerMsg = triggerBtn.nextElementSibling;
									if (triggerMsg && triggerMsg.classList.contains('productbay-pro-selection-msg')) {
										triggerMsg.style.display = 'block';
										triggerMsg.innerHTML = 'Product(s) added';
										setTimeout(() => { if (triggerMsg) triggerMsg.style.display = 'none'; }, 4000);
									}
								}
							}
						}
					} catch (e) {
						console.warn('ProductBay: Error updating UI message', e);
					}
				} else {
					btn.innerHTML = 'Error';
					console.error(response);
				}
			},
			complete: () => {
				setTimeout(() => {
					if (btn.innerHTML === 'Added ✓') {
						btn.innerHTML = originalText;
						btn.disabled = false;
					}
				}, 2000);
			}
		});
	});

	// ─── 3. Popup Quantity +/- Buttons (Delegated on document.body) ────────────
	// The base plugin's qty handlers are scoped to $wrapper, so popup buttons
	// (which live inside <dialog> outside the wrapper) need their own handlers.
	document.body.addEventListener('click', (e) => {
		const plusBtn = e.target.closest('.productbay-pro-variations-modal .productbay-qty-plus');
		if (plusBtn) {
			e.preventDefault();
			const wrap = plusBtn.closest('.productbay-qty-wrap');
			if (!wrap) return;
			const input = wrap.querySelector('.productbay-qty');
			if (!input) return;
			const max = parseInt(input.getAttribute('max'), 10) || Infinity;
			let val = parseInt(input.value, 10) || 0;
			if (val < max) {
				input.value = val + 1;
				input.dispatchEvent(new Event('input', { bubbles: true }));
			}
			return;
		}

		const minusBtn = e.target.closest('.productbay-pro-variations-modal .productbay-qty-minus');
		if (minusBtn) {
			e.preventDefault();
			const wrap = minusBtn.closest('.productbay-qty-wrap');
			if (!wrap) return;
			const input = wrap.querySelector('.productbay-qty');
			if (!input) return;
			const min = parseInt(input.getAttribute('min'), 10) || 1;
			let val = parseInt(input.value, 10) || min;
			if (val > min) {
				input.value = val - 1;
				input.dispatchEvent(new Event('input', { bubbles: true }));
			}
			return;
		}
	});

	// ─── 4. Nested Rows Trigger ───────────────────────────────────────────────────
	// Helper: load AJAX content into a nested container OR inject rows
	function loadNestedContent(target, productId, tableId, row, originalText) {
		target.disabled = true;
		target.textContent = 'Loading...';

		const data = new URLSearchParams();
		data.append('action', 'productbay_pro_get_variation_html');
		data.append('product_id', productId);
		data.append('table_id', tableId);
		data.append('mode', 'nested');
		data.append('nonce', productbay_pro_ajax.nonce);

		fetch(productbay_pro_ajax.ajax_url, {
			method: 'POST',
			body: data,
		})
			.then(res => res.json())
			.then(response => {
				if (response.success) {
					const nextRow = row.nextElementSibling;

					// If a nested container <tr> exists, populate its inner content
					if (nextRow && nextRow.classList.contains('productbay-pro-nested-row-container') && nextRow.getAttribute('data-parent-id') === productId) {
						const contentCell = nextRow.querySelector('.productbay-pro-nested-row-content');
						if (contentCell) {
							contentCell.innerHTML = '<table class="productbay-table productbay-pro-nested-table"><tbody>' + response.data.html + '</tbody></table>';
						}
						nextRow.style.display = 'table-row';
						nextRow.setAttribute('data-loaded', '1');
					} else {
						// No container — inject rows directly after the current row
						const template = document.createElement('template');
						template.innerHTML = response.data.html;
						const newRows = template.content.querySelectorAll('tr');
						newRows.forEach(nr => nr.setAttribute('data-parent-id', productId));
						row.after(template.content);
					}
					target.textContent = 'Hide Products';
				} else {
					console.error(response.data);
					target.textContent = 'Error';
				}
			})
			.finally(() => {
				target.disabled = false;
				if (target.textContent === 'Loading...') {
					target.textContent = originalText;
				}
			});
	}

	document.body.addEventListener('click', (e) => {
		const target = e.target.closest('.productbay-pro-btn-nested');
		if (!target) return;
		e.preventDefault();

		const productId = target.getAttribute('data-product-id');
		const tableId = target.getAttribute('data-table-id');
		const row = target.closest('tr');

		// Store original text for toggle (data-original-text pattern)
		if (!target.hasAttribute('data-original-text')) {
			target.setAttribute('data-original-text', target.textContent.trim());
		}
		const originalText = target.getAttribute('data-original-text');

		const nextRow = row.nextElementSibling;

		// Case 1: Pre-rendered nested container exists
		if (nextRow && nextRow.classList.contains('productbay-pro-nested-row-container') && nextRow.getAttribute('data-parent-id') === productId) {
			const isHidden = nextRow.style.display === 'none';

			if (isHidden) {
				// If content was never loaded via AJAX, load it now
				if (!nextRow.getAttribute('data-loaded') && nextRow.getAttribute('data-default-expanded') !== '1') {
					loadNestedContent(target, productId, tableId, row, originalText);
					return;
				}
				nextRow.style.display = 'table-row';
				target.textContent = 'Hide Products';
			} else {
				nextRow.style.display = 'none';
				target.textContent = originalText;
			}
			return;
		}

		// Case 2: Previously injected individual nested rows
		if (nextRow && nextRow.classList.contains('productbay-pro-nested-row-item') && nextRow.getAttribute('data-parent-id') === productId) {
			let isHidden = nextRow.style.display === 'none';
			let sibling = nextRow;
			while (sibling && sibling.classList.contains('productbay-pro-nested-row-item') && sibling.getAttribute('data-parent-id') === productId) {
				sibling.style.display = isHidden ? 'table-row' : 'none';
				sibling = sibling.nextElementSibling;
			}
			target.textContent = isHidden ? 'Hide Products' : originalText;
			return;
		}

		// Case 3: First-time load via AJAX
		loadNestedContent(target, productId, tableId, row, originalText);
	});

	// ─── 5. Default-Expanded Nested Rows Initialization ───────────────────────────
	// For nested containers that are pre-rendered with data-default-expanded="1",
	// set the trigger button text to "Hide Products" on page load.
	document.querySelectorAll('.productbay-pro-nested-row-container[data-default-expanded="1"]').forEach((container) => {
		const parentId = container.getAttribute('data-parent-id');
		if (!parentId) return;

		// Find the trigger button in the preceding row
		const parentRow = container.previousElementSibling;
		if (parentRow) {
			const btn = parentRow.querySelector('.productbay-pro-btn-nested[data-product-id="' + parentId + '"]');
			if (btn) {
				if (!btn.hasAttribute('data-original-text')) {
					btn.setAttribute('data-original-text', btn.textContent.trim());
				}
				btn.textContent = 'Hide Products';
			}
		}
	});

	// ─── 6. Grouped Product Inline Select Handler ─────────────────────────────────
	// When a child product is selected: enable qty/cart/checkbox.
	// 'Select All' option => enable checkbox with all child IDs.
	document.body.addEventListener('change', (e) => {
		if (!e.target.classList.contains('productbay-grouped-child-select')) return;

		const select = e.target;
		const wrap = select.closest('.productbay-grouped-inline-wrap');
		if (!wrap) return;

		const qtyInput = wrap.querySelector('.productbay-qty');
		const addBtn = wrap.querySelector('.productbay-grouped-add-btn');
		const priceSpan = wrap.querySelector('.productbay-grouped-inline-price');
		const row = select.closest('tr');
		const rowCheckbox = row ? row.querySelector('.productbay-col-select .productbay-select-product') : null;

		if (!selectedId) {
			// No selection — disable controls
			if (qtyInput) qtyInput.disabled = true;
			if (addBtn) { addBtn.disabled = true; addBtn.setAttribute('data-product-id', ''); }
			if (priceSpan) priceSpan.innerHTML = '';
			if (rowCheckbox) { rowCheckbox.disabled = true; rowCheckbox.checked = false; rowCheckbox.dispatchEvent(new Event('change', { bubbles: true })); }
			wrap.querySelectorAll('.productbay-qty-plus, .productbay-qty-minus').forEach(b => b.disabled = true);
			return;
		}

		if (selectedId === '__all__') {
			// Select All — enable qty/cart with all child IDs
			const allIds = childrenData.map(c => String(c.id));
			if (addBtn) { addBtn.disabled = false; addBtn.setAttribute('data-product-id', allIds.join(',')); }
			if (qtyInput) qtyInput.disabled = false;
			wrap.querySelectorAll('.productbay-qty-plus, .productbay-qty-minus').forEach(b => b.disabled = false);
			if (priceSpan) priceSpan.innerHTML = '';
			if (rowCheckbox) {
				rowCheckbox.disabled = false;
				rowCheckbox.value = allIds.join(',');
				rowCheckbox.setAttribute('data-price', '');
				rowCheckbox.setAttribute('data-multi', '1');
				rowCheckbox.checked = true;
				// Trigger change to update bulk selection
				rowCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
			}
			return;
		}

		// Single child selected — enable all controls
		const child = childrenData.find(c => String(c.id) === selectedId);
		if (child) {
			if (priceSpan) priceSpan.innerHTML = child.price_html;
			if (addBtn) { addBtn.disabled = false; addBtn.setAttribute('data-product-id', String(child.id)); }
			if (qtyInput) qtyInput.disabled = false;
			wrap.querySelectorAll('.productbay-qty-plus, .productbay-qty-minus').forEach(b => b.disabled = false);
			if (rowCheckbox) {
				rowCheckbox.disabled = false;
				rowCheckbox.value = String(child.id);
				rowCheckbox.setAttribute('data-price', String(child.price));
				rowCheckbox.removeAttribute('data-multi');
				rowCheckbox.checked = true;
				rowCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
			}
		}
	});

	// ─── 6b. Grouped Product Add To Cart ──────────────────────────────────────────
	document.body.addEventListener('click', (e) => {
		const btn = e.target.closest('.productbay-grouped-add-btn');
		if (!btn || btn.disabled) return;
		e.preventDefault();

		const wrap = btn.closest('.productbay-grouped-inline-wrap');
		const qtyInput = wrap.querySelector('.productbay-qty');
		const quantity = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;

		const idsStr = btn.getAttribute('data-product-id');
		if (!idsStr) return;

		const ids = idsStr.split(',');
		const items = ids.map(id => ({
			product_id: parseInt(id, 10),
			quantity: quantity,
			variation_id: 0,
			attributes: {}
		}));

		if (!btn.hasAttribute('data-original-text')) {
			btn.setAttribute('data-original-text', btn.innerHTML);
		}
		const originalText = btn.getAttribute('data-original-text');

		btn.innerHTML = 'Adding...';
		btn.disabled = true;

		const $ = window.jQuery;
		if (!$) return;

		$.ajax({
			url: window.productbay_frontend.ajaxurl,
			type: 'POST',
			data: {
				action: 'productbay_bulk_add_to_cart',
				nonce: window.productbay_frontend.nonce,
				items: items
			},
			success: (response) => {
				if (response.success) {
					btn.innerHTML = 'Added ✓';
					$(document.body).trigger('wc_fragment_refresh');
				} else {
					btn.innerHTML = 'Error';
					alert(response.data?.errors?.join('\\n') || 'Error adding to cart');
				}
			},
			error: () => {
				btn.innerHTML = 'Error';
			},
			complete: () => {
				setTimeout(() => {
					if (btn.innerHTML === 'Added ✓' || btn.innerHTML === 'Error') {
						btn.innerHTML = originalText;
						btn.disabled = false;
					}
				}, 2000);
			}
		});
	});

	// ─── 7. Handle Modal Close ────────────────────────────────────────────────────
	document.body.addEventListener('click', (e) => {
		const closeBtn = e.target.closest('.productbay-pro-variations-close');
		const backdrop = e.target.closest('.productbay-pro-variations-backdrop');

		if (closeBtn || backdrop) {
			const modal = e.target.closest('.productbay-pro-variations-modal');
			if (modal) {
				modal.close();
			}
		}
	});

	// ─── 8. Popup "Select All" Checkbox ──────────────────────────────────────────
	// In the popup table header, a "select all" checkbox toggles all variation checkboxes.
	document.body.addEventListener('change', (e) => {
		if (!e.target.classList.contains('productbay-pro-popup-select-all')) return;

		const modal = e.target.closest('.productbay-pro-variations-modal');
		if (!modal) return;

		const isChecked = e.target.checked;
		const checkboxes = modal.querySelectorAll('.productbay-pro-popup-table .productbay-select-product');

		checkboxes.forEach(cb => {
			cb.checked = isChecked;
		});
	});



});
