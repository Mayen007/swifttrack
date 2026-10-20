// server/services/customsService.js
// SwiftTrack Kenya: Track 4.3 East African Community (EAC) Customs Manifest Export Service
// Standardized cross-border road transit manifest matching KRA TradeNet / ASYCUDA XML specification
const crypto = require('crypto');
const dbAdapter = require('../db/dbAdapter.js');
const transportService = require('./transportService.js');

class CustomsService {
    /**
     * Map border corridors to official EAC Customs One-Stop Border Post (OSBP) codes
     */
    getBorderPostMetadata(corridorName = '') {
        const name = String(corridorName).toUpperCase();
        if (name.includes('MALABA')) {
            return {
                code: 'KEMLB',
                name: 'Malaba One-Stop Border Post',
                countryPair: 'KE-UG',
                exitOffice: 'KE002-MALABA',
                entryOffice: 'UG001-TORORO',
                transitCorridor: 'Northern Corridor (Mombasa-Nairobi-Kampala-Kigali)'
            };
        }
        if (name.includes('BUSIA')) {
            return {
                code: 'KEBSA',
                name: 'Busia One-Stop Border Post',
                countryPair: 'KE-UG',
                exitOffice: 'KE003-BUSIA',
                entryOffice: 'UG002-BUSIA',
                transitCorridor: 'Northern Corridor (Kisumu-Busia-Jinja)'
            };
        }
        if (name.includes('NAMANGA')) {
            return {
                code: 'KENGA',
                name: 'Namanga One-Stop Border Post',
                countryPair: 'KE-TZ',
                exitOffice: 'KE004-NAMANGA',
                entryOffice: 'TZ001-NAMANGA',
                transitCorridor: 'Central Transit Corridor (Nairobi-Arusha-Dodoma)'
            };
        }
        if (name.includes('ISEBANIA')) {
            return {
                code: 'KEISB',
                name: 'Isebania One-Stop Border Post',
                countryPair: 'KE-TZ',
                exitOffice: 'KE005-ISEBANIA',
                entryOffice: 'TZ002-SIRARI',
                transitCorridor: 'Lake Victoria Basin Transit Corridor'
            };
        }
        if (name.includes('MOYALE')) {
            return {
                code: 'KEMOY',
                name: 'Moyale One-Stop Border Post',
                countryPair: 'KE-ET',
                exitOffice: 'KE006-MOYALE',
                entryOffice: 'ET001-MOYALE',
                transitCorridor: 'LAPSSET Corridor (Isiolo-Moyale-Addis Ababa)'
            };
        }
        // Default / Generic EAC Northern Corridor
        return {
            code: 'KEMLB',
            name: 'Malaba One-Stop Border Post',
            countryPair: 'KE-UG',
            exitOffice: 'KE002-MALABA',
            entryOffice: 'UG001-TORORO',
            transitCorridor: 'Northern Corridor Transit Link'
        };
    }

    /**
     * Generate East African Community (EAC) ASYCUDA / TradeNet Road Transit Manifest
     * @param {number|string} transportRunId - ID of transport run
     * @param {Object} options - Export options { format: 'xml' | 'json', borderPost: string }
     */
    async generateEACManifest(transportRunId, options = {}) {
        const runId = Number(transportRunId);
        const run = await transportService.getTransportRunById(runId);
        if (!run) {
            throw new Error(`Transport run ${runId} not found`);
        }

        // Fetch vehicle details
        const vehicle = run.vehicle_id ? await dbAdapter.get(`
            SELECT v.*, b.name as branch_name
            FROM vehicles v
            LEFT JOIN branches b ON v.branch_id = b.id
            WHERE v.id = ?
        `, [run.vehicle_id]) : null;

        // Fetch driver details
        const driver = run.driver_id ? await dbAdapter.get(`
            SELECT d.*, u.full_name as user_full_name, u.phone as user_phone, u.national_id as user_national_id
            FROM drivers d
            LEFT JOIN users u ON d.user_id = u.id
            WHERE d.id = ?
        `, [run.driver_id]) : null;

        // Fetch all shipments assigned to this manifest
        const manifest = run.manifest;
        let shipments = [];
        if (manifest && Array.isArray(manifest.items) && manifest.items.length > 0) {
            const shipmentIds = manifest.items.map(i => i.shipment_id).filter(Boolean);
            if (shipmentIds.length > 0) {
                const placeholders = shipmentIds.map(() => '?').join(',');
                shipments = await dbAdapter.all(`
                    SELECT s.*,
                           orig.name as origin_branch_name, orig.city as origin_city,
                           dest.name as destination_branch_name, dest.city as destination_city
                    FROM shipments s
                    LEFT JOIN branches orig ON s.origin_hub_id = orig.id
                    LEFT JOIN branches dest ON s.destination_hub_id = dest.id
                    WHERE s.id IN (${placeholders})
                `, shipmentIds);
            }
        }

        const borderPostInfo = this.getBorderPostMetadata(options.borderPost || run.route_name || run.destination_hub_name);

        // Calculate consignment totals
        const totalWaybills = shipments.length;
        const totalPackages = shipments.reduce((sum, s) => sum + Number(s.total_parcels || 1), 0);
        const totalGrossWeightKg = shipments.reduce((sum, s) => sum + Number(s.chargeable_weight_kg || s.actual_weight_kg || 10), 0);
        const totalDeclaredValueKes = shipments.reduce((sum, s) => sum + Number(s.declared_value || 5000), 0);
        const totalDeclaredValueUsd = Math.round(totalDeclaredValueKes / 130); // Est KES/USD conversion

        const departureTimestamp = run.dispatched_at || run.scheduled_departure || new Date().toISOString();
        const manifestNumber = manifest?.manifest_number || `EAC-TRN-${run.run_number || run.id}`;

        const consignmentsData = shipments.map((s, idx) => ({
            consignment_item_number: idx + 1,
            waybill_number: s.tracking_number,
            origin: s.origin_city || run.origin_hub_name || 'Nairobi',
            destination: s.destination_city || run.destination_hub_name || 'Kampala',
            consignor: {
                name: s.sender_name || 'Consignor Shipper',
                phone: s.sender_phone || '+254700000000',
                address: s.sender_address || 'Industrial Area, Nairobi'
            },
            consignee: {
                name: s.recipient_name || 'Consignee Receiver',
                phone: s.recipient_phone || '+256700000000',
                address: s.recipient_address || 'Commercial Depot, Uganda'
            },
            packages_count: Number(s.total_parcels || 1),
            gross_weight_kg: Number(s.chargeable_weight_kg || s.actual_weight_kg || 10),
            goods_description: s.description || 'General Merchandise Cargo',
            hs_code: s.hs_code || '8471.30.00',
            declared_value_kes: Number(s.declared_value || 5000),
            seal_number: `SEAL-${String(runId).padStart(4, '0')}-${idx + 1}`
        }));

        // Assembly of Manifest Data Object
        const manifestPayload = {
            eac_tradenet_specification: 'EAC-ASYCUDA-ROAD-MANIFEST-V2',
            manifest_header: {
                manifest_reference: manifestNumber,
                transit_corridor: borderPostInfo.transitCorridor,
                country_corridor_pair: borderPostInfo.countryPair,
                customs_office_departure: borderPostInfo.exitOffice,
                customs_border_post: borderPostInfo.name,
                customs_border_code: borderPostInfo.code,
                customs_office_destination: borderPostInfo.entryOffice,
                date_of_departure: departureTimestamp,
                transport_mode: 'ROAD_FREIGHT_30'
            },
            carrier_particulars: {
                operator_name: 'SwiftTrack Logistics Kenya Ltd',
                operator_tin_kra: 'P051234567Z',
                registered_office: 'SwiftTrack Central Hub, Mombasa Road, Nairobi, Kenya',
                transit_bond_guarantee_no: `KRA-CBG-${new Date().getFullYear()}-00912`
            },
            transport_equipment: {
                vehicle_registration: vehicle?.registration_number || 'KDC 123A',
                country_of_registration: 'KENYA',
                vehicle_make_model: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Scania R500 Commercial Truck',
                chassis_number: vehicle?.chassis_number || 'SCN992817264589',
                trailer_registration: 'ZD 4412',
                container_seal_number: `KE-SEAL-${runId}-${Date.now().toString().slice(-4)}`
            },
            driver_particulars: {
                full_name: driver?.full_name || driver?.user_full_name || 'Peter Mwangi Kamau',
                driving_license: driver?.license_number || 'DL-KE-992144',
                national_id_or_passport: driver?.national_id || driver?.user_national_id || 'ID-28192014',
                mobile_phone: driver?.phone || driver?.user_phone || '+254722000111'
            },
            cargo_summary: {
                total_waybills: totalWaybills,
                total_packages: totalPackages,
                total_gross_mass_kg: totalGrossWeightKg,
                total_declared_value_kes: totalDeclaredValueKes,
                total_declared_value_usd: totalDeclaredValueUsd
            },
            consignments: consignmentsData
        };

        // Digital cryptographic manifest seal (SHA-256 integrity hash)
        const canonicalString = JSON.stringify(manifestPayload);
        const digitalSeal = crypto.createHash('sha256').update(canonicalString).digest('hex');
        manifestPayload.security = {
            digital_manifest_hash: digitalSeal,
            generated_at: new Date().toISOString(),
            algorithm: 'SHA-256'
        };

        // Format selector
        if (options.format === 'json') {
            return manifestPayload;
        }

        // Render EAC ASYCUDA XML
        return this.renderAsycudaXml(manifestPayload);
    }

    /**
     * Serializes manifest payload into standard ASYCUDA XML schema
     */
    renderAsycudaXml(manifest) {
        const h = manifest.manifest_header;
        const c = manifest.carrier_particulars;
        const t = manifest.transport_equipment;
        const d = manifest.driver_particulars;
        const s = manifest.cargo_summary;

        const escapeXml = (unsafe) => {
            return String(unsafe || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        };

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<ASYCUDA_Road_Manifest xmlns="urn:eac:customs:tradenet:manifest:v2">\n`;
        xml += `  <Header>\n`;
        xml += `    <ManifestReference>${escapeXml(h.manifest_reference)}</ManifestReference>\n`;
        xml += `    <TransitCorridor>${escapeXml(h.transit_corridor)}</TransitCorridor>\n`;
        xml += `    <DepartureOffice>${escapeXml(h.customs_office_departure)}</DepartureOffice>\n`;
        xml += `    <BorderPostCode>${escapeXml(h.customs_border_code)}</BorderPostCode>\n`;
        xml += `    <BorderPostName>${escapeXml(h.customs_border_post)}</BorderPostName>\n`;
        xml += `    <DestinationOffice>${escapeXml(h.customs_office_destination)}</DestinationOffice>\n`;
        xml += `    <DepartureDate>${escapeXml(h.date_of_departure)}</DepartureDate>\n`;
        xml += `    <TransportMode>${escapeXml(h.transport_mode)}</TransportMode>\n`;
        xml += `  </Header>\n`;

        xml += `  <Carrier>\n`;
        xml += `    <OperatorName>${escapeXml(c.operator_name)}</OperatorName>\n`;
        xml += `    <OperatorTIN>${escapeXml(c.operator_tin_kra)}</OperatorTIN>\n`;
        xml += `    <TransitBond>${escapeXml(c.transit_bond_guarantee_no)}</TransitBond>\n`;
        xml += `  </Carrier>\n`;

        xml += `  <TransportEquipment>\n`;
        xml += `    <RegistrationPlate>${escapeXml(t.vehicle_registration)}</RegistrationPlate>\n`;
        xml += `    <Country>${escapeXml(t.country_of_registration)}</Country>\n`;
        xml += `    <MakeModel>${escapeXml(t.vehicle_make_model)}</MakeModel>\n`;
        xml += `    <ChassisVIN>${escapeXml(t.chassis_number)}</ChassisVIN>\n`;
        xml += `    <TrailerPlate>${escapeXml(t.trailer_registration)}</TrailerPlate>\n`;
        xml += `    <ContainerSeal>${escapeXml(t.container_seal_number)}</ContainerSeal>\n`;
        xml += `  </TransportEquipment>\n`;

        xml += `  <Driver>\n`;
        xml += `    <FullName>${escapeXml(d.full_name)}</FullName>\n`;
        xml += `    <LicenseNumber>${escapeXml(d.driving_license)}</LicenseNumber>\n`;
        xml += `    <NationalIDOrPassport>${escapeXml(d.national_id_or_passport)}</NationalIDOrPassport>\n`;
        xml += `    <Phone>${escapeXml(d.mobile_phone)}</Phone>\n`;
        xml += `  </Driver>\n`;

        xml += `  <CargoSummary>\n`;
        xml += `    <TotalWaybills>${s.total_waybills}</TotalWaybills>\n`;
        xml += `    <TotalPackages>${s.total_packages}</TotalPackages>\n`;
        xml += `    <TotalGrossWeightKg>${s.total_gross_mass_kg}</TotalGrossWeightKg>\n`;
        xml += `    <TotalDeclaredValueKES>${s.total_declared_value_kes}</TotalDeclaredValueKES>\n`;
        xml += `    <TotalDeclaredValueUSD>${s.total_declared_value_usd}</TotalDeclaredValueUSD>\n`;
        xml += `  </CargoSummary>\n`;

        xml += `  <Consignments>\n`;
        for (const item of manifest.consignments) {
            xml += `    <Consignment itemNumber="${item.consignment_item_number}">\n`;
            xml += `      <WaybillNumber>${escapeXml(item.waybill_number)}</WaybillNumber>\n`;
            xml += `      <OriginCity>${escapeXml(item.origin)}</OriginCity>\n`;
            xml += `      <DestinationCity>${escapeXml(item.destination)}</DestinationCity>\n`;
            xml += `      <Consignor>\n`;
            xml += `        <Name>${escapeXml(item.consignor.name)}</Name>\n`;
            xml += `        <Phone>${escapeXml(item.consignor.phone)}</Phone>\n`;
            xml += `        <Address>${escapeXml(item.consignor.address)}</Address>\n`;
            xml += `      </Consignor>\n`;
            xml += `      <Consignee>\n`;
            xml += `        <Name>${escapeXml(item.consignee.name)}</Name>\n`;
            xml += `        <Phone>${escapeXml(item.consignee.phone)}</Phone>\n`;
            xml += `        <Address>${escapeXml(item.consignee.address)}</Address>\n`;
            xml += `      </Consignee>\n`;
            xml += `      <GoodsDescription>${escapeXml(item.goods_description)}</GoodsDescription>\n`;
            xml += `      <HSCode>${escapeXml(item.hs_code)}</HSCode>\n`;
            xml += `      <PackagesCount>${item.packages_count}</PackagesCount>\n`;
            xml += `      <GrossWeightKg>${item.gross_weight_kg}</GrossWeightKg>\n`;
            xml += `      <DeclaredValueKES>${item.declared_value_kes}</DeclaredValueKES>\n`;
            xml += `      <SealNumber>${escapeXml(item.seal_number)}</SealNumber>\n`;
            xml += `    </Consignment>\n`;
        }
        xml += `  </Consignments>\n`;

        xml += `  <SecurityIntegritySeal>\n`;
        xml += `    <HashAlgorithm>${manifest.security.algorithm}</HashAlgorithm>\n`;
        xml += `    <DigitalSealHash>${manifest.security.digital_manifest_hash}</DigitalSealHash>\n`;
        xml += `    <GeneratedAt>${manifest.security.generated_at}</GeneratedAt>\n`;
        xml += `  </SecurityIntegritySeal>\n`;
        xml += `</ASYCUDA_Road_Manifest>\n`;

        return xml;
    }
}

const customsService = new CustomsService();
module.exports = customsService;
