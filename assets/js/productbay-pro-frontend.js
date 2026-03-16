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
					this.$tooltipMin.text(this.formatPrice(minVal)).css('left', minPercent + '%');
				}
				if (this.$tooltipMax.length) {
					this.$tooltipMax.text(this.formatPrice(maxVal)).css('left', maxPercent + '%');
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
			// Re-use logic from the main table instance
			const wrapperId = this.$wrapper.attr('id');
			// We need to find the instance. The free plugin doesn't store instances globally yet.
			// But we can trigger a refresh by calling the internal fetch logic if we can access it.
			// For now, let's trigger a custom event that the main script can listen for.
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

})(jQuery);

/**
 * ProductBay Pro - Variations Frontend Interactivity
 */
// productbay-pro-frontend.js
document.addEventListener('DOMContentLoaded', () => {

	// 1. Popup Trigger
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

		const content = modal.querySelector('.productbay-pro-variations-inner');
		content.innerHTML = `<p style="padding: 20px; text-align: center;">Loading variations...</p>`;

		// Store the button that triggered it so we can update its message later if needed
		modal.setAttribute('data-trigger-btn', productId);

		modal.showModal();

		// Fetch via AJAX
		const data = new URLSearchParams();
		data.append('action', 'productbay_pro_get_variation_html');
		data.append('product_id', productId);
		data.append('table_id', tableId);
		data.append('mode', 'popup');

		fetch(productbay_pro_ajax.ajax_url, {
			method: 'POST',
			body: data,
		})
			.then(res => res.json())
			.then(response => {
				if (response.success) {
					content.innerHTML = response.data.html;
				} else {
					content.innerHTML = `<p style="color:red; padding: 20px;">Error: ${response.data}</p>`;
				}
			});
	});

	// 2. Add to Cart inside Popup
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

		// We use jQuery here to match the free plugin's approach and variable availability
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

	// 3. Nested Rows Trigger
	document.body.addEventListener('click', (e) => {
		const target = e.target.closest('.productbay-pro-btn-nested');
		if (!target) return;
		e.preventDefault();

		const productId = target.getAttribute('data-product-id');
		const tableId = target.getAttribute('data-table-id');
		const row = target.closest('tr');

		// Check if we already loaded it
		const nextRow = row.nextElementSibling;
		if (nextRow && nextRow.classList.contains('productbay-pro-nested-row-item') && nextRow.getAttribute('data-parent-id') === productId) {
			// Toggle visibility
			let isHidden = nextRow.style.display === 'none';

			// Select all sibling rows that belong to this parent and toggle them
			let sibling = nextRow;
			while (sibling && sibling.classList.contains('productbay-pro-nested-row-item') && sibling.getAttribute('data-parent-id') === productId) {
				sibling.style.display = isHidden ? 'table-row' : 'none';
				sibling = sibling.nextElementSibling;
			}
			return;
		}

		// First load
		target.disabled = true;
		const originalText = target.innerHTML;
		target.innerHTML = 'Loading...';

		const data = new URLSearchParams();
		data.append('action', 'productbay_pro_get_variation_html');
		data.append('product_id', productId);
		data.append('table_id', tableId);
		data.append('mode', 'nested');

		fetch(productbay_pro_ajax.ajax_url, {
			method: 'POST',
			body: data,
		})
			.then(res => res.json())
			.then(response => {
				if (response.success) {
					// We need to inject the rows directly after `row`
					// Convert HTML string to nodes
					const template = document.createElement('template');
					template.innerHTML = response.data.html;

					// Tag the new rows with data-parent-id so we can toggle them later
					const newRows = template.content.querySelectorAll('tr');
					newRows.forEach(nr => nr.setAttribute('data-parent-id', productId));

					// Insert after the current row
					row.after(template.content);
					target.innerHTML = 'Hide Products';
				} else {
					console.error(response.data);
					target.innerHTML = 'Error';
				}
			})
			.finally(() => {
				target.disabled = false;
				if (target.innerHTML === 'Loading...') {
					target.innerHTML = originalText;
				}
			});
	});

	// Handle Modal Close
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

});
