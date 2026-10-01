import React from 'react';
import {
  Banknote,
  Fuel,
  Wrench,
  Package,
  Zap,
  Coffee,
  Eye
} from 'lucide-react';
import { api } from '../../services/api.js';

export function ExpenseTable({
  expenses,
  user,
  onInspect,
  onApprove
}) {
  const renderCategoryIcon = (cat) => {
    switch (cat) {
      case 'Fuel':
        return <Fuel className="w-3.5 h-3.5 text-amber-400" />;
      case 'Maintenance':
        return <Wrench className="w-3.5 h-3.5 text-blue-400" />;
      case 'Packaging':
        return <Package className="w-3.5 h-3.5 text-indigo-400" />;
      case 'Utilities':
        return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
      default:
        return <Coffee className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
              <th className="p-3">Voucher #</th>
              <th className="p-3">Timestamp</th>
              <th className="p-3">Category</th>
              <th className="p-3">Merchant / Payee & Description</th>
              <th className="p-3">Method</th>
              <th className="p-3">Submitted By</th>
              <th className="p-3 text-right">Amount (KES)</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222834]">
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-slate-500 font-mono">
                  <Banknote className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <span>No expense vouchers found matching the filter parameters.</span>
                </td>
              </tr>
            ) : (
              expenses.map((exp) => {
                const isApproved = exp.status === 'APPROVED';
                const isPending = exp.status === 'PENDING_APPROVAL';

                return (
                  <tr key={exp.id} className="hover:bg-[#181d28]/40 transition-colors">
                    <td className="p-3 font-bold text-emerald-400">
                      {exp.expense_number || `#EXP-${exp.id}`}
                    </td>

                    <td className="p-3 text-slate-400 text-[10px] tabular-nums">
                      {new Date(exp.created_at).toLocaleString('en-KE')}
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        {renderCategoryIcon(exp.category)}
                        <span className="font-semibold text-slate-200">{exp.category}</span>
                      </div>
                    </td>

                    <td className="p-3 max-w-sm">
                      <div className="font-bold text-slate-100">{exp.payee || 'Direct Expense'}</div>
                      <div className="text-[11px] text-slate-400 truncate" title={exp.description}>
                        {exp.description}
                      </div>
                    </td>

                    <td className="p-3">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#0c0e12] border border-[#222834] text-slate-300">
                        {exp.payment_method || 'CASH'}
                      </span>
                    </td>

                    <td className="p-3 text-slate-300 text-[11px]">
                      <span>{exp.created_by_name || 'Staff'}</span>
                      <span className="text-[10px] text-slate-500 block">{exp.branch_name || 'Main Hub'}</span>
                    </td>

                    <td className="p-3 text-right font-bold font-mono text-rose-400 tabular-nums text-sm">
                      -{api.formatKES(exp.amount)}
                    </td>

                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase flex items-center justify-center gap-1 ${
                          isApproved
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        <span className={`w-1 h-1 rounded-full ${isApproved ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                        {exp.status || 'APPROVED'}
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onInspect(exp)}
                          className="p-1.5 rounded bg-[#0c0e12] hover:bg-[#181d28] text-slate-400 hover:text-white border border-[#222834] transition-colors cursor-pointer"
                          title="Inspect Voucher"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {isPending && (user?.role === 'BRANCH_MANAGER' || user?.role === 'SUPER_ADMIN') && (
                          <button
                            onClick={() => onApprove(exp.id)}
                            className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                            title="Authorize Expense"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
