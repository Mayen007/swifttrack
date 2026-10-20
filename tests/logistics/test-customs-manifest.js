// tests/logistics/test-customs-manifest.js
// SwiftTrack Kenya: Track 4.3 East African Community (EAC) Customs Road Manifest Export Test
const assert = require('assert');
const customsService = require('../../server/services/customsService.js');

console.log('============================================================');
console.log('  SWIFTTRACK KENYA: EAC CUSTOMS MANIFEST EXPORT TEST');
console.log('============================================================\n');

async function runTests() {
    // TEST 1: EAC Cross-Border Corridor & OSBP Mapping
    console.log('> TEST 1: EAC Border Post & Transit Corridor Resolution...');
    const malaba = customsService.getBorderPostMetadata('Malaba Cross-Border Run');
    assert.strictEqual(malaba.code, 'KEMLB', 'Malaba code must be KEMLB');
    assert.strictEqual(malaba.countryPair, 'KE-UG', 'Malaba pair must be KE-UG');
    assert.ok(malaba.transitCorridor.includes('Northern Corridor'));

    const namanga = customsService.getBorderPostMetadata('Nairobi to Arusha via Namanga');
    assert.strictEqual(namanga.code, 'KENGA', 'Namanga code must be KENGA');
    assert.strictEqual(namanga.countryPair, 'KE-TZ', 'Namanga pair must be KE-TZ');

    const busia = customsService.getBorderPostMetadata('Busia Border Checkpoint');
    assert.strictEqual(busia.code, 'KEBSA', 'Busia code must be KEBSA');
    console.log('  [PASS] Regional One-Stop Border Post (OSBP) metadata resolution verified');

    // TEST 2: ASYCUDA XML Schema Serialization
    console.log('> TEST 2: ASYCUDA Road Transit Manifest XML Serialization...');
    const mockManifestData = {
        manifest_header: {
            manifest_reference: 'EAC-TRN-RUN-8001',
            transit_corridor: 'Northern Corridor (Mombasa-Nairobi-Kampala)',
            country_corridor_pair: 'KE-UG',
            customs_office_departure: 'KE001-ICD-NAIROBI',
            customs_border_post: 'Malaba One-Stop Border Post',
            customs_border_code: 'KEMLB',
            customs_office_destination: 'UG001-KAMPALA-DEPOT',
            date_of_departure: '2026-10-18T08:00:00Z',
            transport_mode: 'ROAD_FREIGHT_30'
        },
        carrier_particulars: {
            operator_name: 'SwiftTrack Logistics Kenya Ltd',
            operator_tin_kra: 'P051234567Z',
            registered_office: 'Mombasa Road, Nairobi',
            transit_bond_guarantee_no: 'KRA-CBG-2026-00912'
        },
        transport_equipment: {
            vehicle_registration: 'KDC 789B',
            country_of_registration: 'KENYA',
            vehicle_make_model: 'Mercedes-Benz Actros 3340',
            chassis_number: 'WDB9340331L123456',
            trailer_registration: 'ZD 8821',
            container_seal_number: 'KE-SEAL-8001-9921'
        },
        driver_particulars: {
            full_name: 'Ali Hassan Omari',
            driving_license: 'DL-KE-443322',
            national_id_or_passport: 'ID-23112233',
            mobile_phone: '+254711223344'
        },
        cargo_summary: {
            total_waybills: 2,
            total_packages: 15,
            total_gross_mass_kg: 2450.5,
            total_declared_value_kes: 750000,
            total_declared_value_usd: 5769
        },
        consignments: [
            {
                consignment_item_number: 1,
                waybill_number: 'SWT-KE-UG-001',
                origin: 'Nairobi',
                destination: 'Kampala',
                consignor: { name: 'Nairobi Tech Hub Ltd', phone: '+254711000111', address: 'Westlands, Nairobi' },
                consignee: { name: 'Uganda Telecom Solutions', phone: '+256700111222', address: 'Jinja Road, Kampala' },
                packages_count: 5,
                gross_weight_kg: 450.5,
                goods_description: 'Network routers and telecommunications spares',
                hs_code: '8517.62.00',
                declared_value_kes: 350000,
                seal_number: 'SEAL-001'
            },
            {
                consignment_item_number: 2,
                waybill_number: 'SWT-KE-UG-002',
                origin: 'Nairobi',
                destination: 'Kampala',
                consignor: { name: 'East Africa Pharmaceuticals Ltd', phone: '+254722000222', address: 'Industrial Area, Nairobi' },
                consignee: { name: 'Kampala Medical Center Supplies', phone: '+256700333444', address: 'Mulago Complex, Kampala' },
                packages_count: 10,
                gross_weight_kg: 2000,
                goods_description: 'Cold-chain diagnostic medical supplies & reagents',
                hs_code: '3002.15.00',
                declared_value_kes: 400000,
                seal_number: 'SEAL-002'
            }
        ],
        security: {
            algorithm: 'SHA-256',
            digital_manifest_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
            generated_at: '2026-10-18T10:00:00.000Z'
        }
    };

    const xml = customsService.renderAsycudaXml(mockManifestData);

    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Must contain XML declaration');
    assert.ok(xml.includes('<ASYCUDA_Road_Manifest'), 'Must contain ASYCUDA root element');
    assert.ok(xml.includes('<ManifestReference>EAC-TRN-RUN-8001</ManifestReference>'), 'Must contain manifest reference');
    assert.ok(xml.includes('<BorderPostCode>KEMLB</BorderPostCode>'), 'Must contain border code');
    assert.ok(xml.includes('<RegistrationPlate>KDC 789B</RegistrationPlate>'), 'Must contain vehicle registration');
    assert.ok(xml.includes('<FullName>Ali Hassan Omari</FullName>'), 'Must contain driver full name');
    assert.ok(xml.includes('<TotalGrossWeightKg>2450.5</TotalGrossWeightKg>'), 'Must contain cargo summary weight');
    assert.ok(xml.includes('<Consignment itemNumber="1">'), 'Must contain consignment items');
    assert.ok(xml.includes('<HSCode>8517.62.00</HSCode>'), 'Must contain Harmonized System (HS) code');
    assert.ok(xml.includes('<DigitalSealHash>9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08</DigitalSealHash>'), 'Must contain cryptographic seal');
    console.log('  [PASS] Standard EAC ASYCUDA XML road manifest schema generation verified');

    // TEST 3: XML Entity Escaping / Sanitization
    console.log('> TEST 3: XML Injection Protection & Entity Escaping...');
    const unsafeData = {
        ...mockManifestData,
        consignments: [{
            ...mockManifestData.consignments[0],
            goods_description: 'Machinery & Tools <Industrial> "Special Edition" & Parts'
        }]
    };
    const sanitizedXml = customsService.renderAsycudaXml(unsafeData);
    assert.ok(sanitizedXml.includes('&amp;'), '& must be escaped to &amp;');
    assert.ok(sanitizedXml.includes('&lt;Industrial&gt;'), '< > must be escaped');
    assert.ok(sanitizedXml.includes('&quot;Special Edition&quot;'), 'Quotes must be escaped');
    console.log('  [PASS] Special character escaping and XML sanitization verified');

    console.log('\n============================================================');
    console.log('[SUCCESS] ALL 3 EAC CUSTOMS MANIFEST EXPORT TESTS PASSED!');
    console.log('============================================================\n');
}

runTests().catch(err => {
    console.error('\n[FAIL] Test suite failed:', err);
    process.exit(1);
});
