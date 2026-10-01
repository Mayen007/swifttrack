import React from 'react';
import { Printer, X, FileText } from 'lucide-react';
import { api } from '../../services/api.js';

export function OrderInvoiceModal({
  isOpen,
  onClose,
  invoiceLoading,
  invoiceData,
}) {
  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none overflow-y-auto">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-xl w-full shadow-2xl relative my-auto animate-in fade-in duration-150 text-xs font-mono">
            <div className="p-4 border-b border-[#222834] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>COMMERCIAL TAX INVOICE</span>
              </h3>
              <button onClick={() => onClose()} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 max-h-[75vh] overflow-y-auto">
              {invoiceLoading || !invoiceData ? (
                <div className="py-12 text-center text-slate-400">Loading invoice data...</div>
              ) : (
                <div id="tax-invoice-printable" className="bg-white text-black p-6 rounded shadow font-sans text-xs space-y-4">
                  {/* Tax Invoice Header */}
                  <div className="flex justify-between items-start border-b pb-4">
                    <div>
                      <h2 className="text-base font-black uppercase tracking-wider text-neutral-900">{invoiceData.company.company_name}</h2>
                      <p className="text-[11px] text-neutral-600">{invoiceData.company.address}</p>
                      <p className="text-[11px] text-neutral-600">KRA PIN: <strong>{invoiceData.company.kra_pin}</strong></p>
                      <p className="text-[11px] text-neutral-600">{invoiceData.company.email} • {invoiceData.company.phone}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded bg-neutral-900 text-white font-mono font-bold text-[10px]">
                        ORIGINAL TAX INVOICE
                      </span>
                      <h3 className="text-sm font-bold text-neutral-800 mt-1 font-mono">{invoiceData.invoice_number}</h3>
                      <p className="text-[11px] text-neutral-500 font-mono">Date: {new Date(invoiceData.date).toLocaleDateString('en-KE')}</p>
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div className="grid grid-cols-2 gap-4 border-b pb-4 text-[11px]">
                    <div>
                      <span className="text-[10px] uppercase text-neutral-500 font-bold block">BILLED TO:</span>
                      <p className="font-bold text-neutral-900">{invoiceData.customer.name}</p>
                      <p className="text-neutral-600">Phone: {invoiceData.customer.phone}</p>
                      <p className="text-neutral-600">KRA PIN: {invoiceData.customer.kra_pin}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-neutral-500 font-bold block">DELIVERY ADDRESS:</span>
                      <p className="text-neutral-800">{invoiceData.customer.delivery_address}</p>
                      <p className="text-neutral-600">{invoiceData.customer.delivery_city}</p>
                    </div>
                  </div>

                  {/* Line Items */}
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b font-bold text-neutral-600 uppercase text-[9px]">
                        <th className="pb-1.5">Description</th>
                        <th className="pb-1.5 text-center">Qty</th>
                        <th className="pb-1.5 text-right">Unit Price</th>
                        <th className="pb-1.5 text-right">VAT Rate</th>
                        <th className="pb-1.5 text-right">Total (KES)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {invoiceData.items.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2">
                            <span className="font-medium text-neutral-900 block">{it.name}</span>
                            <span className="text-[9px] text-neutral-500 font-mono">{it.sku}</span>
                          </td>
                          <td className="py-2 text-center tabular-nums">{it.quantity}</td>
                          <td className="py-2 text-right tabular-nums">{api.formatKES(it.unit_price)}</td>
                          <td className="py-2 text-right">{it.tax_rate}%</td>
                          <td className="py-2 text-right font-bold tabular-nums">{api.formatKES(it.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals Breakdown */}
                  <div className="border-t pt-3 space-y-1 text-[11px] max-w-xs ml-auto font-mono">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Taxable Base:</span>
                      <span className="tabular-nums">{api.formatKES(invoiceData.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">KRA VAT (16%):</span>
                      <span className="tabular-nums">{api.formatKES(invoiceData.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Delivery Fee:</span>
                      <span className="tabular-nums">{api.formatKES(invoiceData.delivery_fee)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xs pt-1.5 border-t border-black">
                      <span>TOTAL DUE:</span>
                      <span className="tabular-nums">{api.formatKES(invoiceData.total_amount)}</span>
                    </div>
                  </div>

                  {/* KRA ETR Compliance Stamp */}
                  <div className="border-t pt-3 text-[10px] text-neutral-600 text-center font-mono">
                    <p>ETR FISCAL CODE: {invoiceData.etr_compliance.fiscal_code}</p>
                    <p className="text-[9px] text-neutral-500 mt-0.5">THIS IS A VALID TAX INVOICE SUBJECT TO KRA REGULATIONS</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#222834] flex justify-end gap-2 bg-[#0c0e12]">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PRINT INVOICE</span>
              </button>
              <button
                type="button"
                onClick={() => onClose()}
                className="px-4 py-2 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
  );
}
