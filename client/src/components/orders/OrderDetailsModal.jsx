import React from 'react';
import {
  X,
  FileText,
  ShieldCheck,
  Check,
  Send,
  ChevronRight,
  AlertTriangle,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { STATE_MACHINE_STEPS, getStatusBadge } from './constants.js';

export function OrderDetailsModal({
  isOpen,
  onClose,
  order,
  detailTab,
  setDetailTab,
  onTransition,
  onOpenCancel,
  onOpenInvoice,
  newNoteText,
  setNewNoteText,
  onAddNote,
  submittingNote,
}) {
  if (!isOpen || !order) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 select-none overflow-y-auto">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-4xl w-full shadow-2xl relative my-auto animate-in fade-in duration-150 text-xs font-mono">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[#222834] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center font-bold">
                  #{order.id}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white uppercase">{order.order_number}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Customer: <strong className="text-slate-200">{order.customer_name}</strong> ({order.customer_phone})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenInvoice(order)}
                  className="px-2.5 py-1 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>TAX INVOICE</span>
                </button>
                <button
                  onClick={() => onClose()}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* STATE MACHINE PROGRESS STEPPER */}
            <div className="p-4 bg-[#0c0e12] border-b border-[#222834]">
              {order.status === 'CANCELLED' ? (
                <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span className="font-bold">ORDER CANCELLED</span>
                    <span className="text-[11px] text-slate-400">({order.cancellation_reason || 'Staff cancelled'})</span>
                  </div>
                  <span className="text-[10px] text-rose-400 font-mono">Inventory Reservations Released</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between overflow-x-auto no-scrollbar gap-1 py-1">
                    {STATE_MACHINE_STEPS.map((step, idx) => {
                      const currentIdx = STATE_MACHINE_STEPS.findIndex((s) => s.key === order.status);
                      const isCompleted = idx < currentIdx;
                      const isCurrent = idx === currentIdx;

                      return (
                        <div key={step.key} className="flex items-center gap-1 shrink-0">
                          <div
                            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 border ${
                              isCurrent
                                ? 'bg-amber-400 text-slate-950 border-amber-400 shadow'
                                : isCompleted
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-[#161c28] text-slate-500 border-[#222834]'
                            }`}
                          >
                            {isCompleted && <Check className="w-3 h-3 text-emerald-400" />}
                            <span>{step.label}</span>
                          </div>
                          {idx < STATE_MACHINE_STEPS.length - 1 && (
                            <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Critical Invariant Callout */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1b212c] text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Inventory Status:</span>
                      {order.inventory_allocated ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>ALLOCATED (RESERVED)</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>UNALLOCATED (Required before READY_FOR_DISPATCH)</span>
                        </span>
                      )}
                    </div>

                    {/* Next Action Buttons based on current state */}
                    <div className="flex items-center gap-2">
                      {order.status === 'DRAFT' && (
                        <button
                          onClick={() => onTransition('CONFIRMED', 'Customer confirmed order')}
                          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                        >
                          CONFIRM & RESERVE INVENTORY
                        </button>
                      )}
                      {order.status === 'CONFIRMED' && (
                        <button
                          onClick={() => onTransition('PROCESSING', 'Order sent to picking')}
                          className="px-3 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer"
                        >
                          START PROCESSING (PICK)
                        </button>
                      )}
                      {order.status === 'PAID' && (
                        <button
                          onClick={() => onTransition('PROCESSING', 'Picking underway')}
                          className="px-3 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer"
                        >
                          START PROCESSING
                        </button>
                      )}
                      {order.status === 'PROCESSING' && (
                        <button
                          onClick={() => onTransition('PACKED', 'Items picked and packed')}
                          className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                        >
                          MARK AS PACKED
                        </button>
                      )}
                      {order.status === 'PACKED' && (
                        <button
                          onClick={() => onTransition('READY_FOR_DISPATCH', 'Staged at dispatch')}
                          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                        >
                          READY FOR DISPATCH (GUARD)
                        </button>
                      )}
                      {order.status === 'READY_FOR_DISPATCH' && (
                        <button
                          onClick={() => onTransition('DISPATCHED', 'Outbound driver handoff')}
                          className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
                        >
                          DISPATCH (DEDUCT STOCK)
                        </button>
                      )}
                      {order.status === 'DISPATCHED' && (
                        <button
                          onClick={() => onTransition('IN_TRANSIT', 'Driver en route')}
                          className="px-3 py-1 rounded bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold cursor-pointer"
                        >
                          MARK IN TRANSIT
                        </button>
                      )}
                      {order.status === 'IN_TRANSIT' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onTransition('DELIVERED', 'POD confirmed')}
                            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                          >
                            CONFIRM DELIVERED
                          </button>
                          <button
                            onClick={() => onTransition('FAILED_DELIVERY', 'Delivery attempt failed')}
                            className="px-2.5 py-1 rounded bg-red-900/50 hover:bg-red-800/70 border border-red-700/60 text-red-300 font-bold cursor-pointer"
                          >
                            FAILED DELIVERY
                          </button>
                        </div>
                      )}
                      {order.status === 'FAILED_DELIVERY' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onTransition('DISPATCHED', 'Re-dispatching after failed delivery')}
                            className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
                          >
                            RE-DISPATCH
                          </button>
                          <button
                            onClick={() => onTransition('RETURNED', 'Returned to warehouse')}
                            className="px-2.5 py-1 rounded bg-amber-900/50 hover:bg-amber-800/70 border border-amber-700/60 text-amber-300 font-bold cursor-pointer"
                          >
                            RETURN TO WH
                          </button>
                        </div>
                      )}
                      {order.status === 'DELIVERED' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onTransition('RETURNED', 'Customer initiated return')}
                            className="px-2.5 py-1 rounded bg-amber-900/50 hover:bg-amber-800/70 border border-amber-700/60 text-amber-300 font-bold cursor-pointer"
                          >
                            RETURN ORDER
                          </button>
                          <button
                            onClick={() => onTransition('REFUNDED', 'Order refunded')}
                            className="px-2.5 py-1 rounded bg-rose-900/50 hover:bg-rose-800/70 border border-rose-700/60 text-rose-300 font-bold cursor-pointer"
                          >
                            REFUND
                          </button>
                        </div>
                      )}
                      {order.status === 'RETURNED' && (
                        <button
                          onClick={() => onTransition('REFUNDED', 'Refund processed for returned items')}
                          className="px-2.5 py-1 rounded bg-rose-900/50 hover:bg-rose-800/70 border border-rose-700/60 text-rose-300 font-bold cursor-pointer"
                        >
                          PROCESS REFUND
                        </button>
                      )}

                      {/* Cancel Order Action */}
                      {!['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status) && (
                        <button
                          onClick={() => onOpenCancel()}
                          className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-bold cursor-pointer"
                        >
                          CANCEL
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TAB NAVIGATION */}
            <div className="flex border-b border-[#222834] px-4 pt-2 gap-2 text-xs font-mono bg-[#161c28]">
              {[
                { id: 'items', label: `Items (${order.items?.length || 0})` },
                { id: 'customer', label: 'Customer & Address' },
                { id: 'timeline', label: `Timeline (${order.timeline?.length || 0})` },
                { id: 'notes', label: `Internal Notes (${order.internal_notes_list?.length || 0})` },
                { id: 'delivery', label: 'Delivery & Fleet' },
              ].map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setDetailTab(tb.id)}
                  className={`py-2 px-3 border-b-2 font-bold cursor-pointer transition-colors ${
                    detailTab === tb.id
                      ? 'border-amber-400 text-amber-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            {/* TAB PANELS */}
            <div className="p-4 sm:p-5 max-h-96 overflow-y-auto">
              {/* TAB 1: ITEMS */}
              {detailTab === 'items' && (
                <div className="space-y-3">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#222834] text-slate-400 uppercase text-[10px]">
                        <th className="pb-2">SKU</th>
                        <th className="pb-2">Product Name</th>
                        <th className="pb-2 text-center">Qty</th>
                        <th className="pb-2 text-right">Unit Price</th>
                        <th className="pb-2 text-right">Total Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222834]">
                      {(order.items || []).map((it) => (
                        <tr key={it.id} className="text-slate-300">
                          <td className="py-2 text-[10px] text-slate-400">{it.sku}</td>
                          <td className="py-2 font-medium text-white">{it.product_name}</td>
                          <td className="py-2 text-center tabular-nums">{it.quantity}</td>
                          <td className="py-2 text-right tabular-nums">{api.formatKES(it.unit_price)}</td>
                          <td className="py-2 text-right font-bold text-emerald-400 tabular-nums">
                            {api.formatKES(it.total_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Summary Totals */}
                  <div className="pt-3 border-t border-[#222834] max-w-xs ml-auto space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal:</span>
                      <span className="text-white tabular-nums">{api.formatKES(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>KRA VAT (16%):</span>
                      <span className="text-white tabular-nums">{api.formatKES(order.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Delivery Fee:</span>
                      <span className="text-white tabular-nums">{api.formatKES(order.delivery_fee)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1 border-t border-[#222834] text-sm">
                      <span className="text-white">TOTAL:</span>
                      <span className="text-emerald-400 tabular-nums">{api.formatKES(order.total_amount)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CUSTOMER & DESTINATION */}
              {detailTab === 'customer' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded bg-[#0c0e12] border border-[#222834] space-y-2">
                    <span className="text-[10px] uppercase text-slate-500 font-bold block">CUSTOMER PROFILE</span>
                    <p className="font-bold text-white text-sm">{order.customer_name}</p>
                    <p className="text-slate-400 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>{order.customer_phone}</span>
                    </p>
                    {order.customer_email && (
                      <p className="text-slate-400 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{order.customer_email}</span>
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500">
                      Customer Number: <strong className="text-slate-300">{order.customer_number || 'N/A'}</strong>
                    </p>
                  </div>

                  <div className="p-3 rounded bg-[#0c0e12] border border-[#222834] space-y-2">
                    <span className="text-[10px] uppercase text-slate-500 font-bold block">DELIVERY DESTINATION</span>
                    <p className="text-white font-medium flex items-start gap-1.5">
                      <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{order.delivery_address || 'Customer Primary Address'}</span>
                    </p>
                    <p className="text-slate-400">City / Region: <strong className="text-slate-200">{order.delivery_city}</strong></p>
                    <p className="text-slate-400">Recipient Contact: {order.recipient_name} ({order.recipient_phone})</p>
                    {order.special_instructions && (
                      <div className="p-2 rounded bg-[#161c28] border border-[#222834] text-[11px] text-slate-300 mt-2">
                        <strong className="text-amber-300">Instructions: </strong> {order.special_instructions}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: STATUS TIMELINE */}
              {detailTab === 'timeline' && (
                <div className="space-y-3">
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">LIFECYCLE STATUS HISTORY</span>
                  <div className="border-l-2 border-[#222834] pl-4 space-y-3">
                    {(order.timeline || []).map((tl) => (
                      <div key={tl.id} className="relative">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.2 rounded text-[10px] font-bold border ${getStatusBadge(tl.to_status)}`}>
                            {tl.to_status}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(tl.created_at).toLocaleString('en-KE')}
                          </span>
                          {tl.user_name && (
                            <span className="text-[10px] text-slate-400">by {tl.user_name} ({tl.user_role})</span>
                          )}
                        </div>
                        {tl.notes && <p className="text-slate-300 text-[11px] mt-1">{tl.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: INTERNAL NOTES */}
              {detailTab === 'notes' && (
                <div className="space-y-4">
                  {/* Note Composer */}
                  <form onSubmit={onAddNote} className="space-y-2">
                    <textarea
                      rows="2"
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Add an internal staff note for this order..."
                      className="w-full p-2.5 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-amber-400 font-sans text-xs"
                      required
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingNote || !newNoteText.trim()}
                        className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>POST NOTE</span>
                      </button>
                    </div>
                  </form>

                  {/* Notes List */}
                  <div className="space-y-2 pt-2 border-t border-[#222834]">
                    {(order.internal_notes_list || []).length === 0 ? (
                      <p className="text-slate-500 text-center py-4">No internal staff notes yet.</p>
                    ) : (
                      order.internal_notes_list.map((n) => (
                        <div key={n.id} className="p-2.5 rounded bg-[#0c0e12] border border-[#222834] space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold text-slate-200">{n.author_name} ({n.author_role})</span>
                            <span>{new Date(n.created_at).toLocaleString('en-KE')}</span>
                          </div>
                          <p className="text-slate-300 text-xs font-sans">{n.note}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: DELIVERY & FLEET */}
              {detailTab === 'delivery' && (
                <div className="space-y-3">
                  {order.delivery ? (
                    <div className="p-3 rounded bg-[#0c0e12] border border-[#222834] space-y-2 text-xs">
                      <div className="flex justify-between items-center pb-2 border-b border-[#222834]">
                        <span className="font-bold text-white uppercase">DELIVERY #{order.delivery.delivery_number}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          {order.delivery.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Driver Assigned</span>
                          <span className="font-bold text-white">{order.delivery.driver_name || 'Unassigned'}</span>
                          {order.delivery.driver_phone && <span className="text-[10px] text-slate-400 block">{order.delivery.driver_phone}</span>}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Fleet Vehicle</span>
                          <span className="font-bold text-white">{order.delivery.registration_number || 'Standard Van'}</span>
                        </div>
                      </div>

                      {order.delivery.pod_recipient && (
                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] mt-2">
                          <strong className="block">PROOF OF DELIVERY RECORDED:</strong>
                          <span>Signed by {order.delivery.pod_recipient} at {order.delivery.pod_verified_at}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-6">No courier delivery record linked for this order.</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#222834] flex justify-end gap-2 bg-[#0c0e12]">
              <button
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
