// server/services/shipmentPricingService.js
// SwiftTrack Logistics: Stage 2 Volumetric Rating & Logistics Pricing Engine
const { db } = require('../db/database.js');

const VOLUMETRIC_DIVISOR = 5000.0; // Standard IATA volumetric divisor (cm^3/kg)
const DEFAULT_VAT_RATE = 16.0; // Kenya standard VAT rate

/**
 * Calculates volumetric weight for a single parcel
 * Formula: (Length_cm * Width_cm * Height_cm) / 5000
 */
function calculateParcelVolumetricWeight(lengthCm = 0, widthCm = 0, heightCm = 0) {
    const l = Number(lengthCm) || 0;
    const w = Number(widthCm) || 0;
    const h = Number(heightCm) || 0;
    if (l <= 0 || w <= 0 || h <= 0) return 0.0;
    const vol = (l * w * h) / VOLUMETRIC_DIVISOR;
    return Math.round(vol * 100) / 100;
}

/**
 * Resolves the applicable tariff for an origin -> destination route and service level
 */
function resolveTariff(originHubId, destinationHubId, serviceType = 'STANDARD') {
    const sType = String(serviceType).toUpperCase();

    // 1. Direct Route-Specific Tariff
    let tariff = db.prepare(`
        SELECT * FROM logistics_pricing_tariffs
        WHERE origin_hub_id = ? AND destination_hub_id = ? AND service_type = ? AND is_active = 1
        LIMIT 1
    `).get(originHubId, destinationHubId, sType);

    // 2. Origin-Wide Tariff fallback
    if (!tariff && originHubId) {
        tariff = db.prepare(`
            SELECT * FROM logistics_pricing_tariffs
            WHERE origin_hub_id = ? AND destination_hub_id IS NULL AND service_type = ? AND is_active = 1
            LIMIT 1
        `).get(originHubId, sType);
    }

    // 3. Universal Network Tariff fallback
    if (!tariff) {
        tariff = db.prepare(`
            SELECT * FROM logistics_pricing_tariffs
            WHERE origin_hub_id IS NULL AND destination_hub_id IS NULL AND service_type = ? AND is_active = 1
            LIMIT 1
        `).get(sType);
    }

    // 4. Default Standard Tariff fallback if specified service level not configured
    if (!tariff) {
        tariff = db.prepare(`
            SELECT * FROM logistics_pricing_tariffs
            WHERE origin_hub_id IS NULL AND destination_hub_id IS NULL AND service_type = 'STANDARD' AND is_active = 1
            LIMIT 1
        `).get();
    }

    // Hard fallback if database table is completely unseeded
    if (!tariff) {
        tariff = {
            base_weight_kg: 5.0,
            base_price: 350.0,
            per_kg_above_base: 50.0,
            cod_fee_percent: 2.0,
            min_cod_fee: 100.0,
            insurance_rate_percent: 1.0,
            remote_area_surcharge: 0.0,
            currency: 'KES'
        };
    }

    return tariff;
}

/**
 * Calculates full price quotation for shipment items and parameters
 *
 * @param {object} params
 * @param {number} params.originHubId
 * @param {number} params.destinationHubId
 * @param {string} params.serviceType - STANDARD, EXPRESS, SAME_DAY
 * @param {Array<{ weight_kg: number, length_cm?: number, width_cm?: number, height_cm?: number }>} params.parcels
 * @param {number} [params.codAmount=0]
 * @param {number} [params.declaredValue=0]
 * @param {number} [params.discountAmount=0]
 * @param {boolean} [params.applyTax=true]
 */
function calculateShipmentQuote({
    originHubId,
    destinationHubId,
    serviceType = 'STANDARD',
    parcels = [],
    codAmount = 0,
    declaredValue = 0,
    discountAmount = 0,
    applyTax = true
}) {
    if (!Array.isArray(parcels) || parcels.length === 0) {
        throw new Error('At least one parcel is required to calculate pricing quote');
    }

    let totalActualWeight = 0;
    let totalVolumetricWeight = 0;

    const ratedParcels = parcels.map((p, idx) => {
        const weight = Number(p.weight_kg) || 0;
        if (weight <= 0) {
            throw new Error(`Parcel #${idx + 1} must have a weight greater than 0 kg`);
        }
        const volWeight = calculateParcelVolumetricWeight(p.length_cm, p.width_cm, p.height_cm);
        totalActualWeight += weight;
        totalVolumetricWeight += volWeight;

        return {
            ...p,
            parcel_index: idx + 1,
            weight_kg: Math.round(weight * 100) / 100,
            volumetric_weight_kg: volWeight,
            chargeable_weight_kg: Math.round(Math.max(weight, volWeight) * 100) / 100
        };
    });

    totalActualWeight = Math.round(totalActualWeight * 100) / 100;
    totalVolumetricWeight = Math.round(totalVolumetricWeight * 100) / 100;
    const totalChargeableWeight = Math.round(Math.max(totalActualWeight, totalVolumetricWeight) * 100) / 100;

    // Resolve Tariff
    const tariff = resolveTariff(originHubId, destinationHubId, serviceType);

    const baseRate = Number(tariff.base_price);
    const baseWeight = Number(tariff.base_weight_kg);
    const perKgAbove = Number(tariff.per_kg_above_base);

    // Additional weight charge
    const extraWeight = Math.max(0, totalChargeableWeight - baseWeight);
    const chargeableExtraUnits = Math.ceil(extraWeight);
    const weightCharge = Math.round((chargeableExtraUnits * perKgAbove) * 100) / 100;

    // COD Surcharge
    const codVal = Math.max(0, Number(codAmount) || 0);
    let codFee = 0.0;
    if (codVal > 0) {
        const calculatedFee = (codVal * (Number(tariff.cod_fee_percent || 2.0) / 100));
        codFee = Math.round(Math.max(Number(tariff.min_cod_fee || 100.0), calculatedFee) * 100) / 100;
    }

    // Insurance Surcharge
    const declaredVal = Math.max(0, Number(declaredValue) || 0);
    let insuranceFee = 0.0;
    if (declaredVal > 0) {
        insuranceFee = Math.round((declaredVal * (Number(tariff.insurance_rate_percent || 1.0) / 100)) * 100) / 100;
    }

    // Remote Area Surcharge
    const remoteSurcharge = Math.round(Number(tariff.remote_area_surcharge || 0) * 100) / 100;

    const totalSurcharges = Math.round((codFee + insuranceFee + remoteSurcharge) * 100) / 100;
    const discount = Math.round((Number(discountAmount) || 0) * 100) / 100;

    const subtotal = Math.max(0, Math.round((baseRate + weightCharge + totalSurcharges - discount) * 100) / 100);

    // VAT Tax Calculation
    const taxAmount = applyTax ? Math.round((subtotal * (DEFAULT_VAT_RATE / 100)) * 100) / 100 : 0.0;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    return {
        currency: tariff.currency || 'KES',
        service_type: serviceType,
        total_parcels: ratedParcels.length,
        actual_weight_kg: totalActualWeight,
        volumetric_weight_kg: totalVolumetricWeight,
        chargeable_weight_kg: totalChargeableWeight,
        base_rate: baseRate,
        weight_charge: weightCharge,
        surcharges: totalSurcharges,
        cod_amount: codVal,
        cod_fee: codFee,
        declared_value: declaredVal,
        insurance_fee: insuranceFee,
        remote_area_surcharge: remoteSurcharge,
        discount_amount: discount,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        tariff_id: tariff.id || null,
        parcels: ratedParcels
    };
}

module.exports = {
    VOLUMETRIC_DIVISOR,
    calculateParcelVolumetricWeight,
    resolveTariff,
    calculateShipmentQuote
};
