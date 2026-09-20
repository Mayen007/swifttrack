// server/services/pricingService.js
// Enterprise Multi-Tier Pricing Engine & KRA Fiscal VAT Calculation Service
const { db } = require('../db/database.js');

const KRA_STANDARD_VAT_RATE = 16.0;

/**
 * Resolves the effective unit price and tax for a product or variant.
 * 
 * Evaluation Priority:
 * 1. Base Product / Variant Retail Price
 * 2. Branch-specific price override (if configured for branchId)
 * 3. Customer-specific price or customer tier special agreement
 * 4. Bulk quantity break pricing (matches tier for quantity)
 * 5. Active scheduled promotion or promo code
 * 6. KRA Fiscal VAT computation (STANDARD_16, ZERO_RATED_0, EXEMPT)
 * 
 * @param {object} params
 * @param {number} params.productId - Product ID
 * @param {number} [params.variantId] - Variant ID (optional)
 * @param {number} [params.branchId] - Branch ID (optional)
 * @param {number} [params.customerId] - Customer ID (optional)
 * @param {string} [params.customerTier] - Customer tier: 'RETAIL', 'WHOLESALE', 'VIP', 'CORPORATE'
 * @param {number} [params.quantity=1] - Quantity being purchased
 * @param {string} [params.promoCode] - Promo code (optional)
 * @param {boolean} [params.isWholesale=false] - If wholesale pricing is requested
 * @returns {object} Calculated pricing structure
 */
function resolvePrice(params = {}) {
    const {
        productId,
        variantId,
        branchId,
        customerId,
        customerTier,
        quantity = 1,
        promoCode,
        isWholesale = false
    } = params;

    const qty = Math.max(1, Number(quantity) || 1);

    // 1. Fetch parent product
    const product = db.prepare(`
        SELECT p.*, c.name as category_name, b.name as brand_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE p.id = ? AND p.is_active = 1 AND p.is_archived = 0
    `).get(Number(productId));

    if (!product) {
        throw new Error(`Product ${productId} not found or inactive`);
    }

    // 2. Fetch variant if specified
    let variant = null;
    if (variantId) {
        variant = db.prepare(`
            SELECT * FROM product_variants
            WHERE id = ? AND product_id = ? AND is_active = 1
        `).get(Number(variantId), Number(productId));
    }

    // Determine baseline prices
    const baseRetail = Number(variant?.selling_price_override ?? product.selling_price) || 0;
    const baseWholesale = Number(variant?.wholesale_price_override ?? product.wholesale_price ?? baseRetail) || baseRetail;
    const baseCost = Number(variant?.cost_price_override ?? product.cost_price) || 0;

    let effectivePrice = isWholesale ? baseWholesale : baseRetail;
    const appliedRules = [];

    // 3. Branch-specific price override
    if (branchId) {
        const branchPrice = db.prepare(`
            SELECT * FROM branch_product_prices
            WHERE branch_id = ? AND product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))
        `).get(Number(branchId), Number(productId), variantId ? Number(variantId) : null, variantId ? Number(variantId) : null);

        if (branchPrice) {
            const targetBranchPrice = isWholesale && branchPrice.wholesale_price
                ? Number(branchPrice.wholesale_price)
                : Number(branchPrice.selling_price);

            if (targetBranchPrice > 0) {
                effectivePrice = targetBranchPrice;
                appliedRules.push({
                    type: 'BRANCH_OVERRIDE',
                    description: `Branch ${branchId} price override applied`,
                    price: effectivePrice
                });
            }
        }
    }

    // 4. Customer-specific / Customer Tier Agreement
    if (customerId || customerTier) {
        let custPrice = null;
        if (customerId) {
            custPrice = db.prepare(`
                SELECT * FROM customer_product_prices
                WHERE customer_id = ? AND product_id = ? AND (variant_id = ? OR variant_id IS NULL)
                  AND min_quantity <= ?
                  AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
                  AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
                ORDER BY min_quantity DESC LIMIT 1
            `).get(Number(customerId), Number(productId), variantId ? Number(variantId) : null, qty);
        }

        if (!custPrice && customerTier) {
            custPrice = db.prepare(`
                SELECT * FROM customer_product_prices
                WHERE customer_tier = ? AND product_id = ? AND (variant_id = ? OR variant_id IS NULL)
                  AND min_quantity <= ?
                  AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
                  AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
                ORDER BY min_quantity DESC LIMIT 1
            `).get(String(customerTier).toUpperCase(), Number(productId), variantId ? Number(variantId) : null, qty);
        }

        if (custPrice) {
            if (custPrice.special_price > 0) {
                effectivePrice = Number(custPrice.special_price);
            } else if (custPrice.discount_percent > 0) {
                effectivePrice = effectivePrice * (1 - (Number(custPrice.discount_percent) / 100));
            }
            appliedRules.push({
                type: 'CUSTOMER_AGREEMENT',
                description: `Customer agreement pricing applied (${custPrice.customer_tier || 'Direct'})`,
                price: effectivePrice
            });
        }
    }

    // 5. Bulk Quantity Break Pricing
    const bulkTier = db.prepare(`
        SELECT * FROM product_bulk_pricing
        WHERE product_id = ? AND (variant_id = ? OR variant_id IS NULL)
          AND min_quantity <= ?
          AND (max_quantity IS NULL OR max_quantity >= ?)
        ORDER BY min_quantity DESC LIMIT 1
    `).get(Number(productId), variantId ? Number(variantId) : null, qty, qty);

    if (bulkTier) {
        if (bulkTier.unit_price > 0 && bulkTier.unit_price < effectivePrice) {
            effectivePrice = Number(bulkTier.unit_price);
            appliedRules.push({
                type: 'BULK_TIER',
                description: `Bulk tier (${bulkTier.min_quantity}+ units) unit price applied`,
                price: effectivePrice
            });
        } else if (bulkTier.discount_percent > 0) {
            effectivePrice = effectivePrice * (1 - (Number(bulkTier.discount_percent) / 100));
            appliedRules.push({
                type: 'BULK_TIER_PERCENT',
                description: `Bulk tier ${bulkTier.discount_percent}% discount applied`,
                price: effectivePrice
            });
        }
    }

    // 6. Active Scheduled Promotions & Promo Codes
    const nowIso = new Date().toISOString();
    let promoQuery = `
        SELECT * FROM promotions
        WHERE is_active = 1
          AND (start_date <= ? AND end_date >= ?)
          AND (branch_id IS NULL OR branch_id = ?)
          AND (min_quantity <= ?)
    `;
    const promoParams = [nowIso, nowIso, branchId ? Number(branchId) : null, qty];

    if (promoCode) {
        promoQuery += ' AND (promo_code IS NULL OR UPPER(promo_code) = UPPER(?))';
        promoParams.push(promoCode.trim());
    } else {
        promoQuery += ' AND promo_code IS NULL';
    }

    const eligiblePromos = db.prepare(promoQuery).all(...promoParams);
    for (const promo of eligiblePromos) {
        if (promo.min_spend && (effectivePrice * qty) < Number(promo.min_spend)) {
            continue;
        }

        const matchesScope =
            promo.scope === 'ALL' ||
            (promo.scope === 'PRODUCT' && promo.target_id === Number(productId)) ||
            (promo.scope === 'CATEGORY' && promo.target_id === Number(product.category_id)) ||
            (promo.scope === 'VARIANT' && promo.target_id === Number(variantId));

        if (matchesScope) {
            let promoDiscount = 0;
            if (promo.discount_type === 'PERCENTAGE') {
                promoDiscount = effectivePrice * (Number(promo.discount_value) / 100);
            } else if (promo.discount_type === 'FIXED_AMOUNT') {
                promoDiscount = Math.min(effectivePrice, Number(promo.discount_value) / qty);
            }
            effectivePrice = Math.max(0, effectivePrice - promoDiscount);
            appliedRules.push({
                type: 'PROMOTION',
                promoCode: promo.promo_code,
                name: promo.name,
                discount: promoDiscount,
                price: effectivePrice
            });
            break; // Apply best matching promotion
        }
    }

    // 7. Fiscal Tax Calculation (Kenyan Standard: 16% VAT or 0%)
    let taxRate = 0.0;
    if (product.tax_category === 'STANDARD_16') {
        taxRate = KRA_STANDARD_VAT_RATE;
    } else if (product.tax_category === 'ZERO_RATED_0') {
        taxRate = 0.0;
    } else {
        taxRate = 0.0; // EXEMPT
    }

    const unitPrice = Math.round(effectivePrice * 100) / 100;
    const subtotal = Math.round(unitPrice * qty * 100) / 100;
    const taxAmount = taxRate > 0 ? Math.round((subtotal * (taxRate / (100 + taxRate))) * 100) / 100 : 0.0;
    const netAmount = Math.round((subtotal - taxAmount) * 100) / 100;

    return {
        productId: product.id,
        variantId: variant?.id || null,
        productName: product.name,
        variantName: variant?.variant_name || null,
        sku: variant?.variant_sku || product.sku,
        barcode: variant?.variant_barcode || product.barcode,
        quantity: qty,
        unit: product.unit,
        basePrice: baseRetail,
        costPrice: baseCost,
        unitPrice,
        subtotal,
        taxCategory: product.tax_category,
        taxRate,
        taxAmount,
        netAmount,
        totalAmount: subtotal,
        appliedRules
    };
}

module.exports = {
    resolvePrice,
    KRA_STANDARD_VAT_RATE
};
