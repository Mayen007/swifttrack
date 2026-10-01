import React from 'react';
import { Receipt, Plus } from 'lucide-react';
import { sound } from '../../services/sound.js';
import { getProcurementStatusBadge } from './constants.jsx';

export function InvoicesTab({
  invoices,
  searchQuery,
  isManagerOrAdmin,
  onLogInvoice,
  onPayInvoice,
  onViewInvoice
}) {
  const filteredInvoices = invoices.filter(inv =>
    !searchQuery ||
    inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.supplier_invoice_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.po_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Receipt className="w-4 h-4 text-amber-400" />
          Supplier Bills & 3-Way Matched Invoices
        </h2>
        {isManagerOrAdmin && (
          <button
            onClick={() => {
              sound.playClick();
              onLogInvoice();
            }}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Log Supplier Invoice
          </button>
        )}
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Vendor Bill #</th>
              <th className="py-3 px-4">Supplier</th>
              <th className="py-3 px-4">PO Reference</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4">Amount Paid / Total</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-8 text-center text-slate-500 text-xs font-sans">
                  No supplier invoices recorded. Invoices support 3-way matching against POs and GRNs.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-white">
                    {inv.invoice_number}
                  </td>
                  <td className="py-3.5 px-4 text-amber-400 font-bold">
                    {inv.supplier_invoice_no}
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 font-sans">
                    {inv.supplier_name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">
                    {inv.po_number || 'DIRECT'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">
                    {inv.due_date}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-emerald-400">{Number(inv.amount_paid).toLocaleString()}</span>
                    <span className="text-slate-500"> / </span>
                    <span className="text-white">{Number(inv.total_amount).toLocaleString()}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    {getProcurementStatusBadge(inv.status)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 font-sans">
                      {inv.status !== 'PAID' && isManagerOrAdmin && (
                        <button
                          onClick={() => {
                            sound.playClick();
                            onPayInvoice(inv);
                          }}
                          className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium border border-amber-500/30"
                        >
                          Pay
                        </button>
                      )}
                      <button
                        onClick={() => {
                          sound.playClick();
                          onViewInvoice(inv);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                      >
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
