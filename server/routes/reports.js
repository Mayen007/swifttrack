// server/routes/reports.js
const express = require('express');
const router = express.Router();
const dbAdapter = require('../db/dbAdapter.js');
const { authenticateToken, enforceBranchIsolation, authorize } = require('../middleware/auth.js');

const isPg = dbAdapter.isPostgres;

const SQL_HELPERS = {
    dateStr: (col) => isPg ? `TO_CHAR(${col}, 'YYYY-MM-DD')` : `date(${col})`,
    todayFilter: (col) => isPg ? `CAST(${col} AS DATE) = CURRENT_DATE` : `date(${col}) = date('now')`,
    currentMonthFilter: (col) => isPg 
        ? `TO_CHAR(${col}, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')` 
        : `strftime('%Y-%m', ${col}) = strftime('%Y-%m', 'now')`,
    monthExpr: (col) => isPg ? `TO_CHAR(${col}, 'YYYY-MM')` : `strftime('%Y-%m', ${col})`,
    daysAgoFilter: (col) => isPg 
        ? `${col} >= CURRENT_DATE - (? * INTERVAL '1 day')` 
        : `date(${col}) >= date('now', '-' || ? || ' days')`
};

// GET /api/reports/dashboard - Role-tailored dashboard metrics
router.get('/dashboard', authenticateToken, enforceBranchIsolation, async (req, res) => {
    try {
        const role = req.user.roleName;
        const branchId = req.effectiveBranchId;

        if (role === 'SUPER_ADMIN') {
            // Super Admin Company-Wide Dashboard
            const targetBranch = req.query.branch_id ? Number(req.query.branch_id) : null;
            const bFilter = targetBranch ? ' WHERE branch_id = ' + targetBranch : '';
            const bFilterAnd = targetBranch ? ' AND branch_id = ' + targetBranch : '';

            const revRow = await dbAdapter.get(`SELECT COALESCE(SUM(total_amount), 0) as total FROM sales ${bFilter}`);
            const revenue = Number(revRow ? revRow.total : 0);

            const todaySalesRow = await dbAdapter.get(`
                SELECT COALESCE(SUM(total_amount), 0) as total, count(*) as count 
                FROM sales 
                WHERE ${SQL_HELPERS.todayFilter('created_at')} ${bFilterAnd}
            `);
            const todaySales = {
                total: Number(todaySalesRow ? todaySalesRow.total : 0),
                count: Number(todaySalesRow ? todaySalesRow.count : 0)
            };

            const monthSalesRow = await dbAdapter.get(`
                SELECT COALESCE(SUM(total_amount), 0) as total 
                FROM sales 
                WHERE ${SQL_HELPERS.currentMonthFilter('created_at')} ${bFilterAnd}
            `);
            const monthSales = Number(monthSalesRow ? monthSalesRow.total : 0);

            const totalOrdersRow = await dbAdapter.get(`SELECT count(*) as count FROM orders ${bFilter}`);
            const totalOrders = Number(totalOrdersRow ? totalOrdersRow.count : 0);

            const branchCountRow = await dbAdapter.get('SELECT count(*) as count FROM branches WHERE is_active = ?', [isPg ? true : 1]);
            const branchCount = Number(branchCountRow ? branchCountRow.count : 0);

            // Inventory Value
            const invValRow = await dbAdapter.get(`
                SELECT COALESCE(SUM(i.quantity_on_hand * p.cost_price), 0) as cost_val,
                       COALESCE(SUM(i.quantity_on_hand * p.selling_price), 0) as retail_val
                FROM inventory i
                JOIN products p ON i.product_id = p.id
                ${targetBranch ? 'WHERE i.branch_id = ' + targetBranch : ''}
            `);
            const invVal = {
                cost_val: Number(invValRow ? invValRow.cost_val : 0),
                retail_val: Number(invValRow ? invValRow.retail_val : 0)
            };

            const lowStockRow = await dbAdapter.get(`
                SELECT count(DISTINCT p.id) as count
                FROM inventory i
                JOIN products p ON i.product_id = p.id
                WHERE i.quantity_on_hand <= p.min_stock_alert ${targetBranch ? 'AND i.branch_id = ' + targetBranch : ''}
            `);
            const lowStockCount = Number(lowStockRow ? lowStockRow.count : 0);

            const deliveriesRow = await dbAdapter.get(`
                SELECT
                    COALESCE(SUM(CASE WHEN status IN ('READY_FOR_DISPATCH', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') THEN 1 ELSE 0 END), 0) as pending,
                    COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as completed,
                    COALESCE(SUM(CASE WHEN status IN ('FAILED', 'RETURN_TO_BRANCH') THEN 1 ELSE 0 END), 0) as failed
                FROM deliveries ${bFilter}
            `);
            const deliveriesStats = {
                pending: Number(deliveriesRow ? deliveriesRow.pending : 0),
                completed: Number(deliveriesRow ? deliveriesRow.completed : 0),
                failed: Number(deliveriesRow ? deliveriesRow.failed : 0)
            };

            const expensesRow = await dbAdapter.get(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'APPROVED' ${bFilterAnd}`);
            const totalExpenses = Number(expensesRow ? expensesRow.total : 0);

            const driversRow = await dbAdapter.get(`SELECT count(*) as count FROM drivers WHERE status = 'AVAILABLE' ${bFilterAnd}`);
            const totalDrivers = Number(driversRow ? driversRow.count : 0);

            // Sales by branch
            const salesByBranch = await dbAdapter.all(`
                SELECT b.id, b.name, b.code, COALESCE(SUM(s.total_amount), 0) as revenue, count(s.id) as sales_count
                FROM branches b
                LEFT JOIN sales s ON b.id = s.branch_id
                GROUP BY b.id, b.name, b.code 
                ORDER BY revenue DESC
            `);

            // Top 5 Products
            const topProducts = await dbAdapter.all(`
                SELECT p.name, p.sku, c.name as category_name,
                       SUM(si.quantity) as units_sold,
                       SUM(si.total_price) as total_revenue
                FROM sale_items si
                JOIN products p ON si.product_id = p.id
                JOIN categories c ON p.category_id = c.id
                JOIN sales s ON si.sale_id = s.id
                ${targetBranch ? 'WHERE s.branch_id = ' + targetBranch : ''}
                GROUP BY p.id, p.name, p.sku, c.name 
                ORDER BY total_revenue DESC LIMIT 5
            `);

            return res.json({
                role: 'SUPER_ADMIN',
                metrics: {
                    total_revenue: revenue,
                    today_sales: todaySales.total,
                    today_sales_count: todaySales.count,
                    monthly_sales: monthSales,
                    total_orders: totalOrders,
                    branch_count: branchCount,
                    inventory_cost_value: invVal.cost_val,
                    inventory_retail_value: invVal.retail_val,
                    low_stock_count: lowStockCount,
                    pending_deliveries: deliveriesStats.pending,
                    completed_deliveries: deliveriesStats.completed,
                    failed_deliveries: deliveriesStats.failed,
                    total_expenses: totalExpenses,
                    active_drivers: totalDrivers,
                    net_profit: revenue - totalExpenses - invVal.cost_val * 0.4
                },
                sales_by_branch: salesByBranch.map(b => ({
                    ...b,
                    revenue: Number(b.revenue || 0),
                    sales_count: Number(b.sales_count || 0)
                })),
                top_products: topProducts.map(p => ({
                    ...p,
                    units_sold: Number(p.units_sold || 0),
                    total_revenue: Number(p.total_revenue || 0)
                }))
            });
        }

        if (role === 'BRANCH_MANAGER') {
            // Branch Manager Dashboard (Restricted to own branch)
            const revRow = await dbAdapter.get('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE branch_id = ?', [branchId]);
            const revenue = Number(revRow ? revRow.total : 0);

            const todaySalesRow = await dbAdapter.get(`
                SELECT COALESCE(SUM(total_amount), 0) as total, count(*) as count 
                FROM sales 
                WHERE branch_id = ? AND ${SQL_HELPERS.todayFilter('created_at')}
            `, [branchId]);
            const todaySales = {
                total: Number(todaySalesRow ? todaySalesRow.total : 0),
                count: Number(todaySalesRow ? todaySalesRow.count : 0)
            };

            const totalOrdersRow = await dbAdapter.get('SELECT count(*) as count FROM orders WHERE branch_id = ?', [branchId]);
            const totalOrders = Number(totalOrdersRow ? totalOrdersRow.count : 0);

            const invValRow = await dbAdapter.get(`
                SELECT COALESCE(SUM(i.quantity_on_hand * p.cost_price), 0) as cost_val,
                       COALESCE(SUM(i.quantity_on_hand * p.selling_price), 0) as retail_val
                FROM inventory i
                JOIN products p ON i.product_id = p.id
                WHERE i.branch_id = ?
            `, [branchId]);
            const invVal = {
                cost_val: Number(invValRow ? invValRow.cost_val : 0),
                retail_val: Number(invValRow ? invValRow.retail_val : 0)
            };

            const lowStockRow = await dbAdapter.get(`
                SELECT count(DISTINCT p.id) as count
                FROM inventory i
                JOIN products p ON i.product_id = p.id
                WHERE i.branch_id = ? AND i.quantity_on_hand <= p.min_stock_alert
            `, [branchId]);
            const lowStockCount = Number(lowStockRow ? lowStockRow.count : 0);

            const deliveriesRow = await dbAdapter.get(`
                SELECT
                    COALESCE(SUM(CASE WHEN status IN ('READY_FOR_DISPATCH', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') THEN 1 ELSE 0 END), 0) as pending,
                    COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as completed,
                    COALESCE(SUM(CASE WHEN status IN ('FAILED', 'RETURN_TO_BRANCH') THEN 1 ELSE 0 END), 0) as failed
                FROM deliveries WHERE branch_id = ?
            `, [branchId]);
            const deliveriesStats = {
                pending: Number(deliveriesRow ? deliveriesRow.pending : 0),
                completed: Number(deliveriesRow ? deliveriesRow.completed : 0),
                failed: Number(deliveriesRow ? deliveriesRow.failed : 0)
            };

            const expensesRow = await dbAdapter.get("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE branch_id = ? AND status = 'APPROVED'", [branchId]);
            const expenses = Number(expensesRow ? expensesRow.total : 0);

            // Cashier Performance
            const cashierPerf = await dbAdapter.all(`
                SELECT u.id, u.full_name, u.username,
                       count(s.id) as sales_count,
                       COALESCE(SUM(s.total_amount), 0) as total_revenue
                FROM users u
                JOIN roles r ON u.role_id = r.id AND r.name = 'CASHIER'
                LEFT JOIN sales s ON u.id = s.cashier_user_id
                WHERE u.branch_id = ?
                GROUP BY u.id, u.full_name, u.username
            `, [branchId]);

            // Driver Performance
            const driverPerf = await dbAdapter.all(`
                SELECT u.full_name, drv.license_number, drv.status,
                       count(d.id) as total_assigned,
                       COALESCE(SUM(CASE WHEN d.status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as delivered_count,
                       COALESCE(SUM(CASE WHEN d.status = 'FAILED' THEN 1 ELSE 0 END), 0) as failed_count
                FROM drivers drv
                JOIN users u ON drv.user_id = u.id
                LEFT JOIN deliveries d ON drv.id = d.driver_id
                WHERE drv.branch_id = ?
                GROUP BY drv.id, u.full_name, drv.license_number, drv.status
            `, [branchId]);

            // Pending Approvals Count (refunds, stock adjustments, expenses)
            const refundPendingRow = await dbAdapter.get("SELECT count(*) as count FROM refund_requests WHERE branch_id = ? AND status = 'PENDING_APPROVAL'", [branchId]);
            const stockPendingRow = await dbAdapter.get("SELECT count(*) as count FROM stock_adjustments WHERE branch_id = ? AND status = 'PENDING_APPROVAL'", [branchId]);
            const expensePendingRow = await dbAdapter.get("SELECT count(*) as count FROM expenses WHERE branch_id = ? AND status = 'PENDING_APPROVAL'", [branchId]);

            const pendingApprovals = {
                refunds: Number(refundPendingRow ? refundPendingRow.count : 0),
                stock_adjustments: Number(stockPendingRow ? stockPendingRow.count : 0),
                expenses: Number(expensePendingRow ? expensePendingRow.count : 0)
            };

            return res.json({
                role: 'BRANCH_MANAGER',
                branch_id: branchId,
                metrics: {
                    today_sales: todaySales.total,
                    today_sales_count: todaySales.count,
                    total_revenue: revenue,
                    total_orders: totalOrders,
                    inventory_cost_value: invVal.cost_val,
                    inventory_retail_value: invVal.retail_val,
                    low_stock_count: lowStockCount,
                    pending_deliveries: deliveriesStats.pending,
                    completed_deliveries: deliveriesStats.completed,
                    failed_deliveries: deliveriesStats.failed,
                    total_expenses: expenses
                },
                cashier_performance: cashierPerf.map(c => ({
                    ...c,
                    sales_count: Number(c.sales_count || 0),
                    total_revenue: Number(c.total_revenue || 0)
                })),
                driver_performance: driverPerf.map(d => ({
                    ...d,
                    total_assigned: Number(d.total_assigned || 0),
                    delivered_count: Number(d.delivered_count || 0),
                    failed_count: Number(d.failed_count || 0)
                })),
                pending_approvals: pendingApprovals
            });
        }

        if (role === 'CASHIER') {
            // Cashier Shift Dashboard
            const shiftRow = await dbAdapter.get(`
                SELECT
                    count(s.id) as sales_count,
                    COALESCE(SUM(s.total_amount), 0) as total_sales,
                    COALESCE(SUM(CASE WHEN p.payment_method = 'CASH' THEN p.amount ELSE 0 END), 0) as cash_total,
                    COALESCE(SUM(CASE WHEN p.payment_method = 'MPESA' THEN p.amount ELSE 0 END), 0) as mpesa_total,
                    COALESCE(SUM(CASE WHEN p.payment_method = 'CARD' THEN p.amount ELSE 0 END), 0) as card_total
                FROM sales s
                LEFT JOIN payments p ON s.id = p.sale_id
                WHERE s.cashier_user_id = ? AND ${SQL_HELPERS.todayFilter('s.created_at')}
            `, [req.user.id]);

            const shift = {
                sales_count: Number(shiftRow ? shiftRow.sales_count : 0),
                total_sales: Number(shiftRow ? shiftRow.total_sales : 0),
                cash_total: Number(shiftRow ? shiftRow.cash_total : 0),
                mpesa_total: Number(shiftRow ? shiftRow.mpesa_total : 0),
                card_total: Number(shiftRow ? shiftRow.card_total : 0)
            };

            const heldSalesRow = await dbAdapter.get('SELECT count(*) as count FROM held_sales WHERE cashier_user_id = ?', [req.user.id]);
            const heldSalesCount = Number(heldSalesRow ? heldSalesRow.count : 0);

            return res.json({
                role: 'CASHIER',
                shift: {
                    ...shift,
                    held_sales_count: heldSalesCount
                }
            });
        }

        if (role === 'DRIVER') {
            const driver = await dbAdapter.get('SELECT id FROM drivers WHERE user_id = ?', [req.user.id]);
            const drvId = driver ? driver.id : 0;

            const statsRow = await dbAdapter.get(`
                SELECT
                    COALESCE(SUM(CASE WHEN status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') THEN 1 ELSE 0 END), 0) as active_count,
                    COALESCE(SUM(CASE WHEN status = 'DELIVERED' AND ${SQL_HELPERS.todayFilter('actual_delivery_at')} THEN 1 ELSE 0 END), 0) as delivered_today,
                    COALESCE(SUM(CASE WHEN status = 'FAILED' AND ${SQL_HELPERS.todayFilter('updated_at')} THEN 1 ELSE 0 END), 0) as failed_today,
                    count(*) as all_time_deliveries
                FROM deliveries WHERE driver_id = ?
            `, [drvId]);

            const stats = {
                active_count: Number(statsRow ? statsRow.active_count : 0),
                delivered_today: Number(statsRow ? statsRow.delivered_today : 0),
                failed_today: Number(statsRow ? statsRow.failed_today : 0),
                all_time_deliveries: Number(statsRow ? statsRow.all_time_deliveries : 0)
            };

            return res.json({
                role: 'DRIVER',
                driver_stats: stats
            });
        }

        // Default dispatcher operational overview
        const dispatchRow = await dbAdapter.get(`
            SELECT
                COALESCE(SUM(CASE WHEN status = 'READY_FOR_DISPATCH' THEN 1 ELSE 0 END), 0) as ready,
                COALESCE(SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END), 0) as assigned,
                COALESCE(SUM(CASE WHEN status = 'IN_TRANSIT' THEN 1 ELSE 0 END), 0) as in_transit,
                COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as delivered,
                COALESCE(SUM(CASE WHEN status IN ('FAILED', 'RETURN_TO_BRANCH') THEN 1 ELSE 0 END), 0) as failed
            FROM deliveries WHERE branch_id = ?
        `, [branchId || 1]);

        res.json({
            role: 'DISPATCHER',
            stats: {
                ready: Number(dispatchRow ? dispatchRow.ready : 0),
                assigned: Number(dispatchRow ? dispatchRow.assigned : 0),
                in_transit: Number(dispatchRow ? dispatchRow.in_transit : 0),
                delivered: Number(dispatchRow ? dispatchRow.delivered : 0),
                failed: Number(dispatchRow ? dispatchRow.failed : 0)
            }
        });
    } catch (err) {
        console.error('Failed to get dashboard metrics:', err);
        res.status(500).json({ error: 'Failed to get dashboard metrics: ' + err.message });
    }
});

// GET /api/reports/dashboard-charts - Comprehensive visual analytics for 10 dashboard graphs & charts
router.get('/dashboard-charts', authenticateToken, authorize('reports', 'financial_own'), async (req, res) => {
    try {
        const targetBranch = req.effectiveBranchId || (req.query.branch_id ? Number(req.query.branch_id) : null);
        const days = Math.min(Math.max(parseInt(req.query.days) || 14, 7), 90);
        const bFilterOrders = targetBranch ? ` WHERE branch_id = ${targetBranch}` : '';
        const bFilterOrdersAnd = targetBranch ? ` AND branch_id = ${targetBranch}` : '';
        const bFilterSalesAnd = targetBranch ? ` AND s.branch_id = ${targetBranch}` : '';
        const bFilterDel = targetBranch ? ` WHERE branch_id = ${targetBranch}` : '';
        const bFilterDelAnd = targetBranch ? ` AND branch_id = ${targetBranch}` : '';

        // 1. Daily Orders Trend (Line chart data for past N days)
        const rawDailyOrders = await dbAdapter.all(`
            SELECT 
                ${SQL_HELPERS.dateStr('created_at')} as order_date, 
                count(*) as order_count,
                COALESCE(SUM(CASE WHEN order_type = 'POS_WALKIN' THEN 1 ELSE 0 END), 0) as pos_count,
                COALESCE(SUM(CASE WHEN order_type = 'DELIVERY_ORDER' THEN 1 ELSE 0 END), 0) as delivery_count
            FROM orders
            WHERE ${SQL_HELPERS.daysAgoFilter('created_at')}
            ${bFilterOrdersAnd}
            GROUP BY ${SQL_HELPERS.dateStr('created_at')}
            ORDER BY order_date ASC
        `, [days]);

        const ordersMap = new Map();
        for (const row of rawDailyOrders) {
            ordersMap.set(row.order_date, {
                order_count: Number(row.order_count || 0),
                pos_count: Number(row.pos_count || 0),
                delivery_count: Number(row.delivery_count || 0)
            });
        }

        // 2. Daily Revenue Trend (Line chart data for past N days)
        const rawDailyRevenue = await dbAdapter.all(`
            SELECT 
                ${SQL_HELPERS.dateStr('s.created_at')} as sale_date,
                COALESCE(SUM(s.total_amount), 0) as gross_revenue,
                COALESCE(SUM(s.subtotal), 0) as net_sales,
                COALESCE(SUM(s.tax_amount), 0) as tax_amount
            FROM sales s
            WHERE ${SQL_HELPERS.daysAgoFilter('s.created_at')}
            ${bFilterSalesAnd}
            GROUP BY ${SQL_HELPERS.dateStr('s.created_at')}
            ORDER BY sale_date ASC
        `, [days]);

        const revenueMap = new Map();
        for (const row of rawDailyRevenue) {
            revenueMap.set(row.sale_date, {
                gross_revenue: Number(row.gross_revenue || 0),
                net_sales: Number(row.net_sales || 0),
                tax_amount: Number(row.tax_amount || 0)
            });
        }

        // Generate full date range sequence to guarantee uninterrupted line charts
        const dailyOrdersTrend = [];
        const revenueTrend = [];
        let totalOrdersInRange = 0;
        let totalRevenueInRange = 0;

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const displayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const oData = ordersMap.get(dateStr) || { order_count: 0, pos_count: 0, delivery_count: 0 };
            const rData = revenueMap.get(dateStr) || { gross_revenue: 0, net_sales: 0, tax_amount: 0 };

            totalOrdersInRange += oData.order_count;
            totalRevenueInRange += rData.gross_revenue;

            dailyOrdersTrend.push({
                date: dateStr,
                label: displayLabel,
                orders: oData.order_count,
                posOrders: oData.pos_count,
                deliveryOrders: oData.delivery_count
            });

            revenueTrend.push({
                date: dateStr,
                label: displayLabel,
                revenue: Math.round(rData.gross_revenue),
                netSales: Math.round(rData.net_sales),
                taxAmount: Math.round(rData.tax_amount)
            });
        }

        // 3. Order Status Breakdown (Donut chart)
        const rawOrderStatus = await dbAdapter.all(`
            SELECT 
                status, 
                count(*) as count,
                COALESCE(SUM(total_amount), 0) as total_amount
            FROM orders
            ${bFilterOrders}
            GROUP BY status
            ORDER BY count DESC
        `);

        const statusConfig = {
            'COMPLETED': { label: 'Completed Walk-in', color: '#10b981' },
            'DELIVERED': { label: 'Delivered', color: '#06b6d4' },
            'DISPATCHED': { label: 'Dispatched / In Transit', color: '#3b82f6' },
            'IN_TRANSIT': { label: 'In Transit', color: '#3b82f6' },
            'READY_FOR_DISPATCH': { label: 'Ready for Dispatch', color: '#f59e0b' },
            'PREPARING': { label: 'Preparing', color: '#8b5cf6' },
            'CONFIRMED': { label: 'Confirmed', color: '#a855f7' },
            'PENDING': { label: 'Pending Processing', color: '#eab308' },
            'CANCELLED': { label: 'Cancelled / Returned', color: '#f43f5e' }
        };

        const totalOrdersAll = rawOrderStatus.reduce((acc, row) => acc + Number(row.count || 0), 0);
        const orderStatus = rawOrderStatus.map(row => {
            const count = Number(row.count || 0);
            const totalAmount = Number(row.total_amount || 0);
            const cfg = statusConfig[row.status] || { label: row.status, color: '#94a3b8' };
            const pct = totalOrdersAll > 0 ? ((count / totalOrdersAll) * 100).toFixed(1) : '0';
            return {
                status: row.status,
                label: cfg.label,
                count: count,
                totalAmount: totalAmount,
                color: cfg.color,
                percentage: parseFloat(pct)
            };
        });

        // 4. Branch Performance Comparison (Bar chart)
        const branchPerformanceRows = await dbAdapter.all(`
            SELECT 
                b.id, 
                b.code, 
                b.name, 
                b.city,
                COALESCE((SELECT SUM(s.total_amount) FROM sales s WHERE s.branch_id = b.id), 0) as revenue,
                COALESCE((SELECT count(*) FROM orders o WHERE o.branch_id = b.id), 0) as total_orders,
                COALESCE((SELECT count(*) FROM deliveries d WHERE d.branch_id = b.id), 0) as total_deliveries,
                COALESCE((SELECT count(*) FROM deliveries d WHERE d.branch_id = b.id AND d.status = 'DELIVERED'), 0) as delivered_count
            FROM branches b
            WHERE b.is_active = ?
            ${targetBranch ? `AND b.id = ${targetBranch}` : ''}
            ORDER BY revenue DESC
        `, [isPg ? true : 1]);

        const branchPerformance = branchPerformanceRows.map(b => {
            const rev = Number(b.revenue || 0);
            const totalOrders = Number(b.total_orders || 0);
            const totalDeliveries = Number(b.total_deliveries || 0);
            const deliveredCount = Number(b.delivered_count || 0);
            const completionRate = totalDeliveries > 0 ? Math.round((deliveredCount / totalDeliveries) * 100) : 100;
            return {
                id: b.id,
                code: b.code,
                name: b.name,
                city: b.city,
                revenue: Math.round(rev),
                ordersCount: totalOrders,
                deliveriesCount: totalDeliveries,
                completedDeliveries: deliveredCount,
                completionRate
            };
        });

        // 5. Employee / Driver Performance (Bar chart)
        const driverPerformanceRows = await dbAdapter.all(`
            SELECT 
                drv.id as driver_id,
                u.full_name as name,
                u.phone,
                drv.license_number,
                b.code as branch_code,
                drv.status as status,
                COUNT(d.id) as total_assigned,
                COALESCE(SUM(CASE WHEN d.status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as delivered,
                COALESCE(SUM(CASE WHEN d.status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') THEN 1 ELSE 0 END), 0) as in_transit,
                COALESCE(SUM(CASE WHEN d.status IN ('FAILED', 'RETURN_TO_BRANCH') THEN 1 ELSE 0 END), 0) as failed
            FROM drivers drv
            JOIN users u ON drv.user_id = u.id
            JOIN branches b ON drv.branch_id = b.id
            LEFT JOIN deliveries d ON drv.id = d.driver_id
            ${targetBranch ? `WHERE drv.branch_id = ${targetBranch}` : ''}
            GROUP BY drv.id, u.full_name, u.phone, drv.license_number, b.code, drv.status
            ORDER BY delivered DESC
        `);

        const driverPerformance = driverPerformanceRows.map(d => {
            const totalAssigned = Number(d.total_assigned || 0);
            const delivered = Number(d.delivered || 0);
            const inTransit = Number(d.in_transit || 0);
            const failed = Number(d.failed || 0);
            const rate = totalAssigned > 0 ? Math.round((delivered / totalAssigned) * 100) : 100;
            return {
                driverId: d.driver_id,
                name: d.name.replace(/\s*\(.*?\)/g, ''), // clean name
                fullName: d.name,
                phone: d.phone,
                licenseNumber: d.license_number,
                branchCode: d.branch_code,
                status: d.status,
                totalAssigned: totalAssigned,
                delivered: delivered,
                inTransit: inTransit,
                failed: failed,
                successRate: rate
            };
        });

        // 6. Delivery Results (Donut chart)
        const delResultsStats = (await dbAdapter.get(`
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as delivered,
                COALESCE(SUM(CASE WHEN status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') THEN 1 ELSE 0 END), 0) as in_transit,
                COALESCE(SUM(CASE WHEN status = 'READY_FOR_DISPATCH' THEN 1 ELSE 0 END), 0) as ready_for_dispatch,
                COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0) as failed,
                COALESCE(SUM(CASE WHEN status = 'RETURN_TO_BRANCH' THEN 1 ELSE 0 END), 0) as returned,
                count(*) as total
            FROM deliveries
            ${bFilterDel}
        `)) || { delivered: 0, in_transit: 0, ready_for_dispatch: 0, failed: 0, returned: 0, total: 0 };

        const delDelivered = Number(delResultsStats.delivered || 0);
        const delInTransit = Number(delResultsStats.in_transit || 0);
        const delReady = Number(delResultsStats.ready_for_dispatch || 0);
        const delFailed = Number(delResultsStats.failed || 0);
        const delReturned = Number(delResultsStats.returned || 0);
        const totalDeliveries = Number(delResultsStats.total || 0) || 1;

        const deliveryResults = [
            {
                key: 'DELIVERED',
                label: 'Delivered Successfully',
                count: delDelivered,
                percentage: Math.round((delDelivered / totalDeliveries) * 100),
                color: '#10b981'
            },
            {
                key: 'IN_TRANSIT',
                label: 'En Route / In Transit',
                count: delInTransit,
                percentage: Math.round((delInTransit / totalDeliveries) * 100),
                color: '#38bdf8'
            },
            {
                key: 'READY_FOR_DISPATCH',
                label: 'Awaiting Pickup',
                count: delReady,
                percentage: Math.round((delReady / totalDeliveries) * 100),
                color: '#f59e0b'
            },
            {
                key: 'FAILED',
                label: 'Delivery Exceptions',
                count: delFailed,
                percentage: Math.round((delFailed / totalDeliveries) * 100),
                color: '#f43f5e'
            },
            {
                key: 'RETURN_TO_BRANCH',
                label: 'Returned to Branch',
                count: delReturned,
                percentage: Math.round((delReturned / totalDeliveries) * 100),
                color: '#a855f7'
            }
        ].filter(r => r.count > 0 || r.key === 'DELIVERED' || r.key === 'IN_TRANSIT' || r.key === 'FAILED');

        // 7. Most Shipped Products & Package Types (Bar chart)
        const rawShippedProducts = await dbAdapter.all(`
            SELECT 
                p.id, 
                p.name, 
                p.sku, 
                c.name as category_name,
                COALESCE(SUM(oi.quantity), 0) as units_shipped,
                COALESCE(SUM(oi.total_price), 0) as total_value
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            WHERE o.status IN ('COMPLETED', 'DELIVERED', 'DISPATCHED', 'IN_TRANSIT')
            ${bFilterOrdersAnd}
            GROUP BY p.id, p.name, p.sku, c.name
            ORDER BY units_shipped DESC
            LIMIT 7
        `);
        const mostShippedProducts = rawShippedProducts.map(p => ({
            ...p,
            units_shipped: Number(p.units_shipped || 0),
            total_value: Number(p.total_value || 0)
        }));

        const rawShippedCategories = await dbAdapter.all(`
            SELECT 
                c.name as category_name,
                COALESCE(SUM(oi.quantity), 0) as units_shipped,
                COALESCE(SUM(oi.total_price), 0) as total_value
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            WHERE o.status IN ('COMPLETED', 'DELIVERED', 'DISPATCHED', 'IN_TRANSIT')
            ${bFilterOrdersAnd}
            GROUP BY c.id, c.name
            ORDER BY units_shipped DESC
        `);
        const mostShippedCategories = rawShippedCategories.map(c => ({
            ...c,
            units_shipped: Number(c.units_shipped || 0),
            total_value: Number(c.total_value || 0)
        }));

        // 8. Pending Products & Package Types in Pipeline (Bar chart)
        const rawPendingProducts = await dbAdapter.all(`
            SELECT 
                p.id, 
                p.name, 
                p.sku, 
                c.name as category_name,
                COALESCE(SUM(oi.quantity), 0) as pending_units,
                COUNT(DISTINCT o.id) as pending_orders_count
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            WHERE o.status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_DISPATCH', 'DISPATCHED')
            ${bFilterOrdersAnd}
            GROUP BY p.id, p.name, p.sku, c.name
            ORDER BY pending_units DESC
            LIMIT 7
        `);
        const pendingProducts = rawPendingProducts.map(p => ({
            ...p,
            pending_units: Number(p.pending_units || 0),
            pending_orders_count: Number(p.pending_orders_count || 0)
        }));

        const rawPendingCategories = await dbAdapter.all(`
            SELECT 
                c.name as category_name,
                COALESCE(SUM(oi.quantity), 0) as pending_units,
                COUNT(DISTINCT o.id) as pending_orders_count
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            WHERE o.status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_DISPATCH', 'DISPATCHED')
            ${bFilterOrdersAnd}
            GROUP BY c.id, c.name
            ORDER BY pending_units DESC
        `);
        const pendingCategories = rawPendingCategories.map(c => ({
            ...c,
            pending_units: Number(c.pending_units || 0),
            pending_orders_count: Number(c.pending_orders_count || 0)
        }));

        // 9. COD Collected vs Outstanding (Bar chart)
        const rawCodStats = (await dbAdapter.get(`
            SELECT 
                COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total_amount ELSE 0 END), 0) as collected_amount,
                COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN 1 ELSE 0 END), 0) as collected_count,
                COALESCE(SUM(CASE WHEN payment_status != 'PAID' AND status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as outstanding_amount,
                COALESCE(SUM(CASE WHEN payment_status != 'PAID' AND status != 'CANCELLED' THEN 1 ELSE 0 END), 0) as outstanding_count
            FROM orders
            WHERE order_type = 'DELIVERY_ORDER'
            ${bFilterOrdersAnd}
        `)) || { collected_amount: 0, collected_count: 0, outstanding_amount: 0, outstanding_count: 0 };

        const codCollected = Number(rawCodStats.collected_amount || 0);
        const codCollectedCount = Number(rawCodStats.collected_count || 0);
        const codOutstanding = Number(rawCodStats.outstanding_amount || 0);
        const codOutstandingCount = Number(rawCodStats.outstanding_count || 0);
        const totalCodVolume = codCollected + codOutstanding;
        const codCollectionRate = totalCodVolume > 0 ? Math.round((codCollected / totalCodVolume) * 100) : 100;

        const codSummary = {
            collectedAmount: Math.round(codCollected),
            collectedCount: codCollectedCount,
            outstandingAmount: Math.round(codOutstanding),
            outstandingCount: codOutstandingCount,
            totalVolume: Math.round(totalCodVolume),
            collectionRatePercent: codCollectionRate,
            comparisonData: [
                {
                    label: 'COD Collected',
                    amount: Math.round(codCollected),
                    count: codCollectedCount,
                    color: '#10b981'
                },
                {
                    label: 'COD Outstanding',
                    amount: Math.round(codOutstanding),
                    count: codOutstandingCount,
                    color: '#f59e0b'
                }
            ]
        };

        // 10. Failed Delivery Reasons (Bar chart)
        const rawFailures = await dbAdapter.all(`
            SELECT 
                COALESCE(failure_reason, 'Customer Not Available') as reason,
                count(*) as count
            FROM deliveries
            WHERE (failure_reason IS NOT NULL OR status = 'FAILED')
            ${bFilterDelAnd}
            GROUP BY COALESCE(failure_reason, 'Customer Not Available')
            ORDER BY count DESC
        `);

        const totalFailures = rawFailures.reduce((acc, row) => acc + Number(row.count || 0), 0);
        const failedDeliveryReasons = rawFailures.map(row => {
            const count = Number(row.count || 0);
            return {
                reason: row.reason,
                count: count,
                percentage: totalFailures > 0 ? Math.round((count / totalFailures) * 100) : 0
            };
        });

        res.json({
            range_days: days,
            totals: {
                orders: totalOrdersInRange,
                revenue: Math.round(totalRevenueInRange),
                all_orders: totalOrdersAll,
                all_deliveries: totalDeliveries
            },
            daily_orders_trend: dailyOrdersTrend,
            revenue_trend: revenueTrend,
            order_status: orderStatus,
            branch_performance: branchPerformance,
            driver_performance: driverPerformance,
            delivery_results: deliveryResults,
            most_shipped_products: mostShippedProducts,
            most_shipped_categories: mostShippedCategories,
            pending_products: pendingProducts,
            pending_categories: pendingCategories,
            cod_summary: codSummary,
            failed_delivery_reasons: failedDeliveryReasons
        });
    } catch (err) {
        console.error('Failed to compute dashboard charts:', err);
        res.status(500).json({ error: 'Failed to compute dashboard visual analytics: ' + err.message });
    }
});

// GET /api/reports/vat - Kenya Revenue Authority 16% VAT Report
router.get('/vat', authenticateToken, authorize('reports', 'financial_own'), async (req, res) => {
    try {
        const branchId = req.effectiveBranchId || (req.query.branch_id ? Number(req.query.branch_id) : null);
        const bFilter = branchId ? ' WHERE s.branch_id = ' + branchId : '';

        // Aggregate summary
        const summary = (await dbAdapter.get(`
            SELECT 
                COALESCE(SUM(s.total_amount), 0) as gross_sales,
                COALESCE(SUM(s.tax_amount), 0) as vat_collected,
                COALESCE(SUM(s.subtotal), 0) as taxable_amount,
                count(s.id) as total_invoices
            FROM sales s
            ${bFilter}
        `)) || { gross_sales: 0, vat_collected: 0, taxable_amount: 0, total_invoices: 0 };

        // Monthly VAT trend
        const monthlyTrendRows = await dbAdapter.all(`
            SELECT 
                ${SQL_HELPERS.monthExpr('s.created_at')} as month,
                COALESCE(SUM(s.total_amount), 0) as gross_sales,
                COALESCE(SUM(s.tax_amount), 0) as output_vat,
                COALESCE(SUM(s.subtotal), 0) as taxable_sales,
                count(s.id) as invoice_count
            FROM sales s
            ${bFilter}
            GROUP BY ${SQL_HELPERS.monthExpr('s.created_at')}
            ORDER BY month DESC
            LIMIT 12
        `);

        // Branch breakdown (if Super Admin or Consolidated view)
        const branchBreakdownRows = await dbAdapter.all(`
            SELECT 
                b.id, b.name, b.code,
                COALESCE(SUM(s.total_amount), 0) as gross_sales,
                COALESCE(SUM(s.tax_amount), 0) as output_vat,
                count(s.id) as invoice_count
            FROM branches b
            LEFT JOIN sales s ON b.id = s.branch_id
            GROUP BY b.id, b.name, b.code
            ORDER BY gross_sales DESC
        `);

        res.json({
            vat_rate_percent: 16.0,
            currency: 'KES',
            summary: {
                gross_sales: Number(summary.gross_sales),
                taxable_amount: Number(summary.taxable_amount),
                vat_collected: Number(summary.vat_collected),
                total_invoices: Number(summary.total_invoices)
            },
            monthly_trend: monthlyTrendRows.map(m => ({
                ...m,
                gross_sales: Number(m.gross_sales),
                output_vat: Number(m.output_vat),
                taxable_sales: Number(m.taxable_sales),
                invoice_count: Number(m.invoice_count)
            })),
            branch_breakdown: branchBreakdownRows.map(b => ({
                ...b,
                gross_sales: Number(b.gross_sales),
                output_vat: Number(b.output_vat),
                invoice_count: Number(b.invoice_count)
            }))
        });
    } catch (err) {
        console.error('Failed to get VAT report:', err);
        res.status(500).json({ error: 'Failed to get VAT report: ' + err.message });
    }
});

// GET /api/reports/pnl - Comprehensive Branch & Consolidated Profit & Loss
router.get('/pnl', authenticateToken, authorize('reports', 'financial_own'), async (req, res) => {
    try {
        const branchId = req.effectiveBranchId || (req.query.branch_id ? Number(req.query.branch_id) : null);
        const bFilterSales = branchId ? ' WHERE s.branch_id = ' + branchId : '';
        const bFilterExpenses = branchId ? ' WHERE branch_id = ' + branchId : '';

        // 1. Gross Revenue & COGS from sales
        const revenueAndCogs = (await dbAdapter.get(`
            SELECT 
                COALESCE(SUM(si.total_price), 0) as gross_revenue,
                COALESCE(SUM(si.quantity * p.cost_price), 0) as cogs
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON si.sale_id = s.id
            ${bFilterSales}
        `)) || { gross_revenue: 0, cogs: 0 };

        const grossRevenue = Number(revenueAndCogs.gross_revenue);
        const cogs = Number(revenueAndCogs.cogs);
        const grossProfit = grossRevenue - cogs;
        const grossMargin = grossRevenue > 0 ? ((grossProfit / grossRevenue) * 100).toFixed(1) : 0;

        // 2. Operating Expenses by category
        const expenseCategoriesRows = await dbAdapter.all(`
            SELECT 
                category,
                COALESCE(SUM(amount), 0) as total
            FROM expenses
            ${bFilterExpenses ? bFilterExpenses + " AND status = 'APPROVED'" : "WHERE status = 'APPROVED'"}
            GROUP BY category
        `);

        const expenseCategories = expenseCategoriesRows.map(cat => ({
            ...cat,
            total: Number(cat.total)
        }));

        const totalExpenses = expenseCategories.reduce((acc, cat) => acc + cat.total, 0);
        const netIncome = grossProfit - totalExpenses;
        const netMargin = grossRevenue > 0 ? ((netIncome / grossRevenue) * 100).toFixed(1) : 0;

        res.json({
            currency: 'KES',
            gross_revenue: grossRevenue,
            cogs: cogs,
            gross_profit: grossProfit,
            gross_margin_percent: Number(grossMargin),
            total_operating_expenses: totalExpenses,
            expense_breakdown: expenseCategories,
            net_income: netIncome,
            net_margin_percent: Number(netMargin)
        });
    } catch (err) {
        console.error('Failed to get PnL report:', err);
        res.status(500).json({ error: 'Failed to get PnL report: ' + err.message });
    }
});

// GET /api/reports/payments - Payment Methods Analysis (M-Pesa, Cash, Card)
router.get('/payments', authenticateToken, authorize('reports', 'financial_own'), async (req, res) => {
    try {
        const branchId = req.effectiveBranchId || (req.query.branch_id ? Number(req.query.branch_id) : null);
        const bFilter = branchId ? ' WHERE s.branch_id = ' + branchId : '';

        const paymentsRows = await dbAdapter.all(`
            SELECT 
                p.payment_method,
                COALESCE(SUM(p.amount), 0) as total_amount,
                count(p.id) as transaction_count
            FROM payments p
            JOIN sales s ON p.sale_id = s.id
            ${bFilter}
            GROUP BY p.payment_method
        `);

        res.json(paymentsRows.map(p => ({
            ...p,
            total_amount: Number(p.total_amount),
            transaction_count: Number(p.transaction_count)
        })));
    } catch (err) {
        console.error('Failed to get payments analysis:', err);
        res.status(500).json({ error: 'Failed to get payments analysis: ' + err.message });
    }
});

module.exports = router;
