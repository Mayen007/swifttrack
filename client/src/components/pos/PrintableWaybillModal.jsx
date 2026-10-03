// client/src/components/pos/PrintableWaybillModal.jsx
import React from 'react';
import { Printer, X, CheckCircle2, ShieldCheck, ArrowRight, Package, MapPin, Phone, Mail, Building2 } from 'lucide-react';
import { api } from '../../services/api.js';

export function PrintableWaybillModal({ isOpen, onClose, waybillData, onNewBooking, onNavigate }) {
  if (!isOpen || !waybillData) return null;

  const w = waybillData;

  const handlePrint = () => {
    window.print();
  };

  const handleViewInShipments = () => {
    const tracking = w.tracking_number || w.waybill_number;
    if (tracking) {
      try {
        sessionStorage.setItem('shipments_search_prefill', tracking);
      } catch (e) {
        // ignore
      }
    }
    onClose();
    if (onNavigate) {
      onNavigate('shipments');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      {/* Modal Container */}
      <div className="relative w-full max-w-3xl bg-[#0c0e14] border border-[#222834] rounded-xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Header Actions (Hidden on Print) */}
        <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-[#121622] border-b border-[#222834]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Official Consignment Waybill & Receipt
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Tracking: <span className="text-emerald-400 font-bold">{w.tracking_number}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {onNavigate && (
              <button
                type="button"
                onClick={handleViewInShipments}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Track and manage this consignment in Shipments View"
              >
                <span>View in Shipments</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PRINT WAYBILL</span>
            </button>
            {onNewBooking && (
              <button
                onClick={() => {
                  onClose();
                  onNewBooking();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#1c2230] hover:bg-[#252d40] border border-[#2c3548] text-slate-200 hover:text-white text-xs font-mono transition-colors cursor-pointer"
              >
                + NEW BOOKING
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#1f2638] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Waybill Sheet */}
        <div className="overflow-y-auto p-4 sm:p-6 text-slate-200 font-sans print:p-0 print:text-black print:bg-white">
          <div className="bg-[#121722] border border-[#222834] rounded-lg p-5 sm:p-7 space-y-5 print:border-black print:bg-white print:p-4 print:text-black">
            
            {/* Top Header & Barcode */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#222834] pb-4 print:border-black">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
                    ST
                  </div>
                  <div>
                    <h1 className="text-base font-extrabold text-white tracking-tight uppercase print:text-black">
                      {w.header?.carrier || 'SwiftTrack Kenya Logistics Ltd'}
                    </h1>
                    <p className="text-[10px] text-slate-400 font-mono print:text-gray-600">
                      {w.header?.tagline} • KRA PIN: {w.header?.kra_pin}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-2 print:text-gray-600">
                  Customer Care: {w.header?.contact}
                </p>
              </div>

              {/* Waybill & Barcode Stamp */}
              <div className="sm:text-right">
                <div className="inline-block bg-[#0c0e14] border border-[#222834] rounded px-3 py-1.5 print:border-black print:bg-transparent">
                  <p className="text-[10px] uppercase font-mono text-slate-400 print:text-gray-600">Tracking Number</p>
                  <p className="text-base font-mono font-black text-emerald-400 tracking-wider print:text-black">
                    {w.tracking_number}
                  </p>
                </div>
                <div className="mt-1 font-mono text-[10px] text-slate-400 print:text-gray-700">
                  WB: <span className="font-semibold text-white print:text-black">{w.waybill_number}</span>
                </div>
                <div className="font-mono text-[9px] text-slate-500 print:text-gray-600">
                  Booked: {new Date(w.booking_date).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Routing Corridor Banner */}
            <div className="grid grid-cols-2 gap-3 bg-[#0a0d14] border border-[#1e2433] rounded-lg p-3 print:bg-gray-100 print:border-black">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-mono font-bold text-xs shrink-0 print:border-black print:text-black">
                  {w.origin?.code || 'ORIG'}
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-mono text-slate-400 uppercase block print:text-gray-600">Origin Hub</span>
                  <p className="text-xs font-bold text-white truncate print:text-black">{w.origin?.name}</p>
                  <p className="text-[10px] text-slate-400 truncate print:text-gray-600">{w.origin?.city}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 justify-end text-right">
                <div className="min-w-0">
                  <span className="text-[9px] font-mono text-slate-400 uppercase block print:text-gray-600">Destination Hub</span>
                  <p className="text-xs font-bold text-white truncate print:text-black">{w.destination?.name}</p>
                  <p className="text-[10px] text-slate-400 truncate print:text-gray-600">{w.destination?.city}</p>
                </div>
                <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-xs shrink-0 print:border-black print:text-black">
                  {w.destination?.code || 'DEST'}
                </div>
              </div>
            </div>

            {/* Shipper & Consignee Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-[#222834] pb-4 print:border-black">
              {/* Shipper Box */}
              <div className="border border-[#1e2433] rounded-lg p-3 bg-[#0f131c] print:border-black print:bg-transparent">
                <div className="flex items-center gap-1.5 text-blue-400 mb-1.5 text-[11px] font-mono font-bold uppercase tracking-wider print:text-black">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Shipper / Sender</span>
                </div>
                <p className="text-xs font-bold text-white print:text-black">{w.shipper?.name}</p>
                <p className="text-[11px] text-slate-300 print:text-gray-800">{w.shipper?.address}</p>
                <p className="text-[11px] text-slate-400 print:text-gray-700">{w.shipper?.city}</p>
                <p className="text-[11px] text-emerald-400 font-mono mt-1 print:text-black">Tel: {w.shipper?.phone}</p>
              </div>

              {/* Consignee Box */}
              <div className="border border-[#1e2433] rounded-lg p-3 bg-[#0f131c] print:border-black print:bg-transparent">
                <div className="flex items-center gap-1.5 text-emerald-400 mb-1.5 text-[11px] font-mono font-bold uppercase tracking-wider print:text-black">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Consignee / Recipient</span>
                </div>
                <p className="text-xs font-bold text-white print:text-black">{w.consignee?.name}</p>
                <p className="text-[11px] text-slate-300 print:text-gray-800">{w.consignee?.address}</p>
                <p className="text-[11px] text-slate-400 print:text-gray-700">{w.consignee?.city}</p>
                <p className="text-[11px] text-emerald-400 font-mono mt-1 print:text-black">Tel: {w.consignee?.phone}</p>
              </div>
            </div>

            {/* Service & Operational Parameters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono bg-[#0c0e14] p-2.5 rounded border border-[#1e2433] print:border-black print:bg-transparent">
              <div>
                <span className="text-[9px] text-slate-500 uppercase block print:text-gray-600">Service Class</span>
                <span className="font-bold text-white uppercase print:text-black">{w.service?.service_type}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase block print:text-gray-600">Delivery Mode</span>
                <span className="font-bold text-white uppercase print:text-black">{w.service?.delivery_type?.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase block print:text-gray-600">Total Parcels</span>
                <span className="font-bold text-emerald-400 print:text-black">{w.totals?.total_parcels} Pcs</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase block print:text-gray-600">Chargeable Wt</span>
                <span className="font-bold text-cyan-400 print:text-black">{w.totals?.chargeable_weight_kg} kg</span>
              </div>
            </div>

            {/* Parcels Manifest Table */}
            <div>
              <h4 className="text-[10px] font-mono uppercase text-slate-400 font-bold mb-1.5 print:text-gray-800">
                Consignment Parcels Manifest
              </h4>
              <div className="overflow-x-auto border border-[#222834] rounded print:border-black">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-[#0b0e14] text-[9px] uppercase font-mono text-slate-400 border-b border-[#222834] print:bg-gray-100 print:text-black print:border-black">
                    <tr>
                      <th className="py-1.5 px-2.5">#</th>
                      <th className="py-1.5 px-2.5">Parcel Barcode</th>
                      <th className="py-1.5 px-2.5">Type</th>
                      <th className="py-1.5 px-2.5">Dimensions (LxWxH)</th>
                      <th className="py-1.5 px-2.5 text-right">Actual Wt</th>
                      <th className="py-1.5 px-2.5 text-right">Volumetric Wt</th>
                      <th className="py-1.5 px-2.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2433] print:divide-black">
                    {w.parcels?.map((p, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="py-1.5 px-2.5 font-mono text-slate-400 print:text-black">{p.item_no}</td>
                        <td className="py-1.5 px-2.5 font-mono font-bold text-white print:text-black">{p.parcel_number}</td>
                        <td className="py-1.5 px-2.5 font-mono uppercase text-slate-300 print:text-black">{p.package_type}</td>
                        <td className="py-1.5 px-2.5 font-mono text-slate-400 print:text-black">{p.dimensions || '—'}</td>
                        <td className="py-1.5 px-2.5 font-mono text-right text-slate-200 print:text-black">{p.weight_kg} kg</td>
                        <td className="py-1.5 px-2.5 font-mono text-right text-slate-400 print:text-black">{p.volumetric_weight_kg} kg</td>
                        <td className="py-1.5 px-2.5 text-slate-300 truncate max-w-[140px] print:text-black">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary & Official Payment Stamp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#222834] pt-4 print:border-black">
              {/* Payment Stamp Box */}
              <div className="border border-emerald-500/30 bg-emerald-950/10 rounded-lg p-3 flex flex-col justify-between print:border-black print:bg-transparent">
                <div>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider mb-2 print:text-black">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Official Payment Receipt Stamp</span>
                  </div>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400 print:text-gray-600">Payment Status:</span>
                      <span className="text-emerald-400 font-bold uppercase print:text-black">{w.payment_receipt?.status}</span>
                    </div>
                    {w.payment_receipt?.payments?.map((pm, idx) => (
                      <div key={idx} className="flex justify-between border-t border-emerald-900/30 pt-1">
                        <span className="text-slate-300 print:text-gray-800">{pm.method} ({pm.reference || 'N/A'}):</span>
                        <span className="font-bold text-white print:text-black">KES {pm.amount}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-emerald-900/30 pt-1">
                      <span className="text-slate-400 print:text-gray-600">Cashier:</span>
                      <span className="text-slate-200 print:text-black">{w.payment_receipt?.cashier_name}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[9px] font-mono text-slate-500 uppercase print:text-gray-600">
                  Electronic Verification Stamp • No Signature Required
                </div>
              </div>

              {/* Financial Charges Breakdown */}
              <div className="font-mono text-[11px] space-y-1.5 bg-[#0c0e14] p-3 rounded-lg border border-[#1e2433] print:border-black print:bg-transparent">
                <div className="flex justify-between text-slate-400 print:text-gray-700">
                  <span>Base Tariff:</span>
                  <span className="text-slate-200 print:text-black">KES {w.financials?.base_rate}</span>
                </div>
                <div className="flex justify-between text-slate-400 print:text-gray-700">
                  <span>Additional Weight:</span>
                  <span className="text-slate-200 print:text-black">KES {w.financials?.weight_charge}</span>
                </div>
                {Number(w.financials?.surcharges) > 0 && (
                  <div className="flex justify-between text-slate-400 print:text-gray-700">
                    <span>Priority Surcharges:</span>
                    <span className="text-slate-200 print:text-black">KES {w.financials?.surcharges}</span>
                  </div>
                )}
                {Number(w.financials?.cod_fee) > 0 && (
                  <div className="flex justify-between text-slate-400 print:text-gray-700">
                    <span>COD Handling Fee:</span>
                    <span className="text-slate-200 print:text-black">KES {w.financials?.cod_fee}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400 print:text-gray-700">
                  <span>VAT (16% Standard):</span>
                  <span className="text-slate-200 print:text-black">KES {w.financials?.tax_amount}</span>
                </div>
                <div className="flex justify-between border-t border-[#222834] pt-2 text-sm font-bold print:border-black">
                  <span className="text-white print:text-black">Total Paid:</span>
                  <span className="text-emerald-400 text-base print:text-black">
                    KES {w.financials?.total_amount}
                  </span>
                </div>
              </div>
            </div>

            {/* Disclaimer & Terms */}
            <div className="border-t border-[#222834] pt-3 text-[9px] text-slate-500 font-mono leading-relaxed print:text-gray-600 print:border-black">
              <p>
                <strong>Terms of Carriage:</strong> {w.terms_and_conditions} Consignee must inspect parcel condition upon receipt before signing proof of delivery. Claims for loss or damage must be filed within 48 hours.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
