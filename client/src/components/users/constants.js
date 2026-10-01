export const RBAC_CAPABILITY_MATRIX = [
  {
    category: 'System & Architecture',
    capabilities: [
      { name: 'Company Settings & Tax Configuration', code: 'company:settings', roles: ['SUPER_ADMIN'] },
      { name: 'Provision Regional Hubs & Warehouses', code: 'branches:create', roles: ['SUPER_ADMIN'] },
      { name: 'View All Provincial Branch Hubs', code: 'branches:view:all', roles: ['SUPER_ADMIN'] },
      { name: 'Manage Assigned Branch Operations', code: 'branches:manage:own', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    category: 'Personnel & Security',
    capabilities: [
      { name: 'Enterprise Staff Provisioning (Global)', code: 'users:create:all', roles: ['SUPER_ADMIN'] },
      { name: 'Branch Station Staff Provisioning', code: 'users:create:own', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { name: 'Role-Based Access Control Audit', code: 'audit:view:all', roles: ['SUPER_ADMIN'] },
      { name: 'Branch Scoped Audit Trail Log', code: 'audit:view:own', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    category: 'Inventory & Depots',
    capabilities: [
      { name: 'Master Product Catalog Management', code: 'products:manage', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { name: 'Multi-Depot Stock Matrix (All Hubs)', code: 'inventory:view:all', roles: ['SUPER_ADMIN'] },
      { name: 'Station Stock Valuation & Ledger', code: 'inventory:view:own', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER'] },
      { name: 'Stock Adjustment Request', code: 'inventory:adjust:request', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER'] },
      { name: 'Stock Adjustment Approval & Write-Off', code: 'inventory:adjust:approve', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { name: 'Inter-Branch Transfer Authorization', code: 'inventory:transfer:approve', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    category: 'Retail POS & Sales',
    capabilities: [
      { name: 'POS Terminal Cashier Checkout', code: 'pos:sale:create', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER'] },
      { name: 'Daraja M-Pesa STK Push / Card / Cash Processing', code: 'pos:payment:process', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER'] },
      { name: 'Customer Return & Refund Request', code: 'refund:request', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER'] },
      { name: 'Dual-Control Refund Approval & Restock', code: 'refund:approve', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { name: 'Managerial Discount Override (>10%)', code: 'discount:approve', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    category: 'Logistics & Fleet Dispatch',
    capabilities: [
      { name: 'Create Delivery Order & Manifest', code: 'delivery:create', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER'] },
      { name: 'Assign Couriers & Fleet Vehicles', code: 'delivery:assign', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER'] },
      { name: 'Update Any Branch Delivery Status', code: 'delivery:update:all', roles: ['SUPER_ADMIN', 'DISPATCHER'] },
      { name: 'Handheld Mobile Console Navigation', code: 'delivery:update:own', roles: ['SUPER_ADMIN', 'DRIVER'] },
      { name: 'Capture HTML5 Signature & SMS OTP POD', code: 'delivery:pod:submit', roles: ['SUPER_ADMIN', 'DRIVER'] },
    ],
  },
  {
    category: 'Financials & Fiscal Governance',
    capabilities: [
      { name: 'Consolidated Financials & P&L Statement', code: 'reports:financial:all', roles: ['SUPER_ADMIN'] },
      { name: 'Branch Financial & Daily Sales Reports', code: 'reports:financial:own', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { name: 'KRA 16% Output VAT Compliance Filing Schedule', code: 'reports:vat:view', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { name: 'Cashier Shift Float Reconciliation', code: 'reports:shift:own', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER'] },
      { name: 'Branch Petty Cash Overhead Submission', code: 'expenses:create', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER', 'DRIVER'] },
      { name: 'Operating Expense Voucher Authorization', code: 'expenses:approve', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
];

export const getRoleBadgeStyle = (roleName) => {
  switch (roleName) {
    case 'SUPER_ADMIN':
      return 'bg-amber-950/70 text-amber-300 border-amber-800/60';
    case 'BRANCH_MANAGER':
      return 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60';
    case 'DISPATCHER':
      return 'bg-blue-950/70 text-blue-300 border-blue-800/60';
    case 'CASHIER':
      return 'bg-amber-950/70 text-amber-300 border-amber-800/60';
    case 'DRIVER':
      return 'bg-cyan-950/70 text-cyan-300 border-cyan-800/60';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
};
