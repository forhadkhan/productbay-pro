(function($) {
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
    $(document).ready(function() {
        $('.productbay-wrapper').each(function() {
            new ProductBayPriceFilter(this);
        });
    });

})(jQuery);
