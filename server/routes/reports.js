// server/routes/reports.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, enforceBranchIsolation } = require('../middleware/auth.js');

// GET /api/reports/dashboard - Role-tailored dashboard metrics
router.get('/dashboard', authenticateToken, enforceBranchIsolation, (req, res) => {
    const role = req.user.roleName;
    const branchId = req.effectiveBranchId;

    if (role === 'SUPER_ADMIN') {
        // Super Admin Company-Wide Dashboard
        const targetBranch = req.query.branch_id ? Number(req.query.branch_id) : null;
        const bFilter = targetBranch ? ' WHERE branch_id = ' + targetBranch : '';
        const bFilterAnd = targetBranch ? ' AND branch_id = ' + targetBranch : '';

        const revenue = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total FROM sales ${bFilter}`).get().total;
        const todaySales = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total, count(*) as count FROM sales WHERE date(created_at) = date('now') ${bFilterAnd}`).get();
        const monthSales = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') ${bFilterAnd}`).get().total;
        const totalOrders = db.prepare(`SELECT count(*) as count FROM orders ${bFilter}`).get().count;
        const branchCount = db.prepare('SELECT count(*) as count FROM branches WHERE is_active = 1').get().count;

        // Inventory Value
        const invVal = db.prepare(`
            SELECT COALESCE(SUM(i.quantity_on_hand * p.cost_price), 0) as cost_val,
                   COALESCE(SUM(i.quantity_on_hand * p.selling_price), 0) as retail_val
            FROM inventory i
            JOIN products p ON i.product_id = p.id
            ${targetBranch ? 'WHERE i.branch_id = ' + targetBranch : ''}
        `).get();

        const lowStockCount = db.prepare(`
            SELECT count(DISTINCT p.id) as count
            FROM inventory i
            JOIN products p ON i.product_id = p.id
            WHERE i.quantity_on_hand <= p.min_stock_alert ${targetBranch ? 'AND i.branch_id = ' + targetBranch : ''}
        `).get().count;

        const deliveriesStats = db.prepare(`
            SELECT
                COALESCE(SUM(CASE WHEN status IN ('READY_FOR_DISPATCH', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') THEN 1 ELSE 0 END), 0) as pending,
                COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as completed,
                COALESCE(SUM(CASE WHEN status IN ('FAILED', 'RETURN_TO_BRANCH') THEN 1 ELSE 0 END), 0) as failed
            FROM deliveries ${bFilter}
        `).get();

        const totalExpenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'APPROVED' ${bFilterAnd}`).get().total;
        const totalDrivers = db.prepare(`SELECT count(*) as count FROM drivers WHERE status = 'AVAILABLE' ${bFilterAnd}`).get().count;

        // Sales by branch
        const salesByBranch = db.prepare(`
            SELECT b.id, b.name, b.code, COALESCE(SUM(s.total_amount), 0) as revenue, count(s.id) as sales_count
            FROM branches b
            LEFT JOIN sales s ON b.id = s.branch_id
            GROUP BY b.id ORDER BY revenue DESC
        `).all();

        // Top 5 Products
        const topProducts = db.prepare(`
            SELECT p.name, p.sku, c.name as category_name,
                   SUM(si.quantity) as units_sold,
                   SUM(si.total_price) as total_revenue
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            JOIN sales s ON si.sale_id = s.id
            ${targetBranch ? 'WHERE s.branch_id = ' + targetBranch : ''}
            GROUP BY p.id ORDER BY total_revenue DESC LIMIT 5
        `).all();

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
            sales_by_branch: salesByBranch,
            top_products: topProducts
        });
    }

    if (role === 'BRANCH_MANAGER') {
        // Branch Manager Dashboard (Restricted to own branch)
        const revenue = db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE branch_id = ?').get(branchId).total;
        const todaySales = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total, count(*) as count FROM sales WHERE branch_id = ? AND date(created_at) = date('now')").get(branchId);
        const totalOrders = db.prepare('SELECT count(*) as count FROM orders WHERE branch_id = ?').get(branchId).count;

        const invVal = db.prepare(`
            SELECT COALESCE(SUM(i.quantity_on_hand * p.cost_price), 0) as cost_val,
                   COALESCE(SUM(i.quantity_on_hand * p.selling_price), 0) as retail_val
            FROM inventory i
            JOIN products p ON i.product_id = p.id
            WHERE i.branch_id = ?
        `).get(branchId);

        const lowStockCount = db.prepare(`
            SELECT count(DISTINCT p.id) as count
            FROM inventory i
            JOIN products p ON i.product_id = p.id
            WHERE i.branch_id = ? AND i.quantity_on_hand <= p.min_stock_alert
        `).get(branchId).count;

        const deliveriesStats = db.prepare(`
            SELECT
                COALESCE(SUM(CASE WHEN status IN ('READY_FOR_DISPATCH', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') THEN 1 ELSE 0 END), 0) as pending,
                COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as completed,
                COALESCE(SUM(CASE WHEN status IN ('FAILED', 'RETURN_TO_BRANCH') THEN 1 ELSE 0 END), 0) as failed
            FROM deliveries WHERE branch_id = ?
        `).get(branchId);

        const expenses = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE branch_id = ? AND status = 'APPROVED'").get(branchId).total;

        // Cashier Performance
        const cashierPerf = db.prepare(`
            SELECT u.id, u.full_name, u.username,
                   count(s.id) as sales_count,
                   COALESCE(SUM(s.total_amount), 0) as total_revenue
            FROM users u
            JOIN roles r ON u.role_id = r.id AND r.name = 'CASHIER'
            LEFT JOIN sales s ON u.id = s.cashier_user_id
            WHERE u.branch_id = ?
            GROUP BY u.id
        `).all(branchId);

        // Driver Performance
        const driverPerf = db.prepare(`
            SELECT u.full_name, drv.license_number, drv.status,
                   count(d.id) as total_assigned,
                   COALESCE(SUM(CASE WHEN d.status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as delivered_count,
                   COALESCE(SUM(CASE WHEN d.status = 'FAILED' THEN 1 ELSE 0 END), 0) as failed_count
            FROM drivers drv
            JOIN users u ON drv.user_id = u.id
            LEFT JOIN deliveries d ON drv.id = d.driver_id
            WHERE drv.branch_id = ?
            GROUP BY drv.id
        `).all(branchId);

        // Pending Approvals Count (refunds, stock adjustments, expenses)
        const pendingApprovals = {
            refunds: db.prepare("SELECT count(*) as count FROM refund_requests WHERE branch_id = ? AND status = 'PENDING_APPROVAL'").get(branchId).count,
            stock_adjustments: db.prepare("SELECT count(*) as count FROM stock_adjustments WHERE branch_id = ? AND status = 'PENDING_APPROVAL'").get(branchId).count,
            expenses: db.prepare("SELECT count(*) as count FROM expenses WHERE branch_id = ? AND status = 'PENDING_APPROVAL'").get(branchId).count
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
            cashier_performance: cashierPerf,
            driver_performance: driverPerf,
            pending_approvals: pendingApprovals
        });
    }

    if (role === 'CASHIER') {
        // Cashier Shift Dashboard
        const shift = db.prepare(`
            SELECT
                count(s.id) as sales_count,
                COALESCE(SUM(s.total_amount), 0) as total_sales,
                COALESCE(SUM(CASE WHEN p.payment_method = 'CASH' THEN p.amount ELSE 0 END), 0) as cash_total,
                COALESCE(SUM(CASE WHEN p.payment_method = 'MPESA' THEN p.amount ELSE 0 END), 0) as mpesa_total,
                COALESCE(SUM(CASE WHEN p.payment_method = 'CARD' THEN p.amount ELSE 0 END), 0) as card_total
            FROM sales s
            LEFT JOIN payments p ON s.id = p.sale_id
            WHERE s.cashier_user_id = ? AND date(s.created_at) = date('now')
        `).get(req.user.id);

        const heldSalesCount = db.prepare('SELECT count(*) as count FROM held_sales WHERE cashier_user_id = ?').get(req.user.id).count;

        return res.json({
            role: 'CASHIER',
            shift: {
                sales_count: shift.sales_count,
                total_sales: shift.total_sales,
                cash_total: shift.cash_total,
                mpesa_total: shift.mpesa_total,
                card_total: shift.card_total,
                held_sales_count: heldSalesCount
            }
        });
    }

    if (role === 'DRIVER') {
        const driver = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(req.user.id);
        const drvId = driver ? driver.id : 0;

        const stats = db.prepare(`
            SELECT
                COALESCE(SUM(CASE WHEN status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') THEN 1 ELSE 0 END), 0) as active_count,
                COALESCE(SUM(CASE WHEN status = 'DELIVERED' AND date(actual_delivery_at) = date('now') THEN 1 ELSE 0 END), 0) as delivered_today,
                COALESCE(SUM(CASE WHEN status = 'FAILED' AND date(updated_at) = date('now') THEN 1 ELSE 0 END), 0) as failed_today,
                count(*) as all_time_deliveries
            FROM deliveries WHERE driver_id = ?
        `).get(drvId);

        return res.json({
            role: 'DRIVER',
            driver_stats: stats
        });
    }

    // Default dispatcher operational overview
    const dispatchStats = db.prepare(`
        SELECT
            COALESCE(SUM(CASE WHEN status = 'READY_FOR_DISPATCH' THEN 1 ELSE 0 END), 0) as ready,
            COALESCE(SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END), 0) as assigned,
            COALESCE(SUM(CASE WHEN status = 'IN_TRANSIT' THEN 1 ELSE 0 END), 0) as in_transit,
            COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as delivered,
            COALESCE(SUM(CASE WHEN status IN ('FAILED', 'RETURN_TO_BRANCH') THEN 1 ELSE 0 END), 0) as failed
        FROM deliveries WHERE branch_id = ?
    `).get(branchId || 1);

    res.json({
        role: 'DISPATCHER',
        stats: dispatchStats
    });
});

// GET /api/reports/dashboard-charts - Comprehensive visual analytics for 10 dashboard graphs & charts
router.get('/dashboard-charts', authenticateToken, enforceBranchIsolation, (req, res) => {
    try {
        const targetBranch = req.effectiveBranchId || (req.query.branch_id ? Number(req.query.branch_id) : null);
        const days = Math.min(Math.max(parseInt(req.query.days) || 14, 7), 90);
        const bFilterOrders = targetBranch ? ` WHERE branch_id = ${targetBranch}` : '';
        const bFilterOrdersAnd = targetBranch ? ` AND branch_id = ${targetBranch}` : '';
        const bFilterSales = targetBranch ? ` WHERE s.branch_id = ${targetBranch}` : '';
        const bFilterSalesAnd = targetBranch ? ` AND s.branch_id = ${targetBranch}` : '';
        const bFilterDel = targetBranch ? ` WHERE branch_id = ${targetBranch}` : '';
        const bFilterDelAnd = targetBranch ? ` AND branch_id = ${targetBranch}` : '';

        // 1. Daily Orders Trend (Line chart data for past N days)
        const rawDailyOrders = db.prepare(`
            SELECT 
                date(created_at) as order_date, 
                count(*) as order_count,
                COALESCE(SUM(CASE WHEN order_type = 'POS_WALKIN' THEN 1 ELSE 0 END), 0) as pos_count,
                COALESCE(SUM(CASE WHEN order_type = 'DELIVERY_ORDER' THEN 1 ELSE 0 END), 0) as delivery_count
            FROM orders
            WHERE date(created_at) >= date('now', '-' || ? || ' days')
            ${bFilterOrdersAnd}
            GROUP BY date(created_at)
            ORDER BY order_date ASC
        `).all(days);

        const ordersMap = new Map();
        for (const row of rawDailyOrders) {
            ordersMap.set(row.order_date, row);
        }

        // 2. Daily Revenue Trend (Line chart data for past N days)
        const rawDailyRevenue = db.prepare(`
            SELECT 
                date(s.created_at) as sale_date,
                COALESCE(SUM(s.total_amount), 0) as gross_revenue,
                COALESCE(SUM(s.subtotal), 0) as net_sales,
                COALESCE(SUM(s.tax_amount), 0) as tax_amount
            FROM sales s
            WHERE date(s.created_at) >= date('now', '-' || ? || ' days')
            ${bFilterSalesAnd}
            GROUP BY date(s.created_at)
            ORDER BY sale_date ASC
        `).all(days);

        const revenueMap = new Map();
        for (const row of rawDailyRevenue) {
            revenueMap.set(row.sale_date, row);
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
        const rawOrderStatus = db.prepare(`
            SELECT 
                status, 
                count(*) as count,
                COALESCE(SUM(total_amount), 0) as total_amount
            FROM orders
            ${bFilterOrders}
            GROUP BY status
            ORDER BY count DESC
        `).all();

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

        const totalOrdersAll = rawOrderStatus.reduce((acc, row) => acc + row.count, 0);
        const orderStatus = rawOrderStatus.map(row => {
            const cfg = statusConfig[row.status] || { label: row.status, color: '#94a3b8' };
            const pct = totalOrdersAll > 0 ? ((row.count / totalOrdersAll) * 100).toFixed(1) : '0';
            return {
                status: row.status,
                label: cfg.label,
                count: row.count,
                totalAmount: row.total_amount,
                color: cfg.color,
                percentage: parseFloat(pct)
            };
        });

        // 4. Branch Performance Comparison (Bar chart)
        const branchPerformance = db.prepare(`
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
            WHERE b.is_active = 1
            ${targetBranch ? `AND b.id = ${targetBranch}` : ''}
            ORDER BY revenue DESC
        `).all().map(b => {
            const completionRate = b.total_deliveries > 0 ? Math.round((b.delivered_count / b.total_deliveries) * 100) : 100;
            return {
                id: b.id,
                code: b.code,
                name: b.name,
                city: b.city,
                revenue: Math.round(b.revenue),
                ordersCount: b.total_orders,
                deliveriesCount: b.total_deliveries,
                completedDeliveries: b.delivered_count,
                completionRate
            };
        });

        // 5. Employee / Driver Performance (Bar chart)
        const driverPerformance = db.prepare(`
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
            GROUP BY drv.id
            ORDER BY delivered DESC
        `).all().map(d => {
            const rate = d.total_assigned > 0 ? Math.round((d.delivered / d.total_assigned) * 100) : 100;
            return {
                driverId: d.driver_id,
                name: d.name.replace(/\s*\(.*?\)/g, ''), // clean name
                fullName: d.name,
                phone: d.phone,
                licenseNumber: d.license_number,
                branchCode: d.branch_code,
                status: d.status,
                totalAssigned: d.total_assigned,
                delivered: d.delivered,
                inTransit: d.in_transit,
                failed: d.failed,
                successRate: rate
            };
        });

        // 6. Delivery Results (Donut chart)
        const delResultsStats = db.prepare(`
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as delivered,
                COALESCE(SUM(CASE WHEN status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') THEN 1 ELSE 0 END), 0) as in_transit,
                COALESCE(SUM(CASE WHEN status = 'READY_FOR_DISPATCH' THEN 1 ELSE 0 END), 0) as ready_for_dispatch,
                COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0) as failed,
                COALESCE(SUM(CASE WHEN status = 'RETURN_TO_BRANCH' THEN 1 ELSE 0 END), 0) as returned,
                count(*) as total
            FROM deliveries
            ${bFilterDel}
        `).get();

        const totalDeliveries = delResultsStats.total || 1;
        const deliveryResults = [
            {
                key: 'DELIVERED',
                label: 'Delivered Successfully',
                count: delResultsStats.delivered,
                percentage: Math.round((delResultsStats.delivered / totalDeliveries) * 100),
                color: '#10b981'
            },
            {
                key: 'IN_TRANSIT',
                label: 'En Route / In Transit',
                count: delResultsStats.in_transit,
                percentage: Math.round((delResultsStats.in_transit / totalDeliveries) * 100),
                color: '#38bdf8'
            },
            {
                key: 'READY_FOR_DISPATCH',
                label: 'Awaiting Pickup',
                count: delResultsStats.ready_for_dispatch,
                percentage: Math.round((delResultsStats.ready_for_dispatch / totalDeliveries) * 100),
                color: '#f59e0b'
            },
            {
                key: 'FAILED',
                label: 'Delivery Exceptions',
                count: delResultsStats.failed,
                percentage: Math.round((delResultsStats.failed / totalDeliveries) * 100),
                color: '#f43f5e'
            },
            {
                key: 'RETURN_TO_BRANCH',
                label: 'Returned to Branch',
                count: delResultsStats.returned,
                percentage: Math.round((delResultsStats.returned / totalDeliveries) * 100),
                color: '#a855f7'
            }
        ].filter(r => r.count > 0 || r.key === 'DELIVERED' || r.key === 'IN_TRANSIT' || r.key === 'FAILED');

        // 7. Most Shipped Products & Package Types (Bar chart)
        const mostShippedProducts = db.prepare(`
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
            GROUP BY p.id
            ORDER BY units_shipped DESC
            LIMIT 7
        `).all();

        const mostShippedCategories = db.prepare(`
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
            GROUP BY c.id
            ORDER BY units_shipped DESC
        `).all();

        // 8. Pending Products & Package Types in Pipeline (Bar chart)
        const pendingProducts = db.prepare(`
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
            GROUP BY p.id
            ORDER BY pending_units DESC
            LIMIT 7
        `).all();

        const pendingCategories = db.prepare(`
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
            GROUP BY c.id
            ORDER BY pending_units DESC
        `).all();

        // 9. COD Collected vs Outstanding (Bar chart)
        const codStats = db.prepare(`
            SELECT 
                COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total_amount ELSE 0 END), 0) as collected_amount,
                COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN 1 ELSE 0 END), 0) as collected_count,
                COALESCE(SUM(CASE WHEN payment_status != 'PAID' AND status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as outstanding_amount,
                COALESCE(SUM(CASE WHEN payment_status != 'PAID' AND status != 'CANCELLED' THEN 1 ELSE 0 END), 0) as outstanding_count
            FROM orders
            WHERE order_type = 'DELIVERY_ORDER'
            ${bFilterOrdersAnd}
        `).get();

        const totalCodVolume = codStats.collected_amount + codStats.outstanding_amount;
        const codCollectionRate = totalCodVolume > 0 ? Math.round((codStats.collected_amount / totalCodVolume) * 100) : 100;

        const codSummary = {
            collectedAmount: Math.round(codStats.collected_amount),
            collectedCount: codStats.collected_count,
            outstandingAmount: Math.round(codStats.outstanding_amount),
            outstandingCount: codStats.outstanding_count,
            totalVolume: Math.round(totalCodVolume),
            collectionRatePercent: codCollectionRate,
            comparisonData: [
                {
                    label: 'COD Collected',
                    amount: Math.round(codStats.collected_amount),
                    count: codStats.collected_count,
                    color: '#10b981'
                },
                {
                    label: 'COD Outstanding',
                    amount: Math.round(codStats.outstanding_amount),
                    count: codStats.outstanding_count,
                    color: '#f59e0b'
                }
            ]
        };

        // 10. Failed Delivery Reasons (Bar chart)
        const rawFailures = db.prepare(`
            SELECT 
                COALESCE(failure_reason, 'Customer Not Available') as reason,
                count(*) as count
            FROM deliveries
            WHERE (failure_reason IS NOT NULL OR status = 'FAILED')
            ${bFilterDelAnd}
            GROUP BY COALESCE(failure_reason, 'Customer Not Available')
            ORDER BY count DESC
        `).all();

        const totalFailures = rawFailures.reduce((acc, row) => acc + row.count, 0);
        const failedDeliveryReasons = rawFailures.map(row => ({
            reason: row.reason,
            count: row.count,
            percentage: totalFailures > 0 ? Math.round((row.count / totalFailures) * 100) : 0
        }));

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
router.get('/vat', authenticateToken, enforceBranchIsolation, (req, res) => {
    const branchId = req.effectiveBranchId || (req.query.branch_id ? Number(req.query.branch_id) : null);
    const bFilter = branchId ? ' WHERE s.branch_id = ' + branchId : '';
    const bAnd = branchId ? ' AND s.branch_id = ' + branchId : '';

    const vatRate = 0.16; // Kenya standard VAT 16%

    // Aggregate summary
    const summary = db.prepare(`
        SELECT 
            COALESCE(SUM(s.total_amount), 0) as gross_sales,
            COALESCE(SUM(s.tax_amount), 0) as vat_collected,
            COALESCE(SUM(s.subtotal), 0) as taxable_amount,
            count(s.id) as total_invoices
        FROM sales s
        ${bFilter}
    `).get();

    // Monthly VAT trend
    const monthlyTrend = db.prepare(`
        SELECT 
            strftime('%Y-%m', s.created_at) as month,
            COALESCE(SUM(s.total_amount), 0) as gross_sales,
            COALESCE(SUM(s.tax_amount), 0) as output_vat,
            COALESCE(SUM(s.subtotal), 0) as taxable_sales,
            count(s.id) as invoice_count
        FROM sales s
        ${bFilter}
        GROUP BY strftime('%Y-%m', s.created_at)
        ORDER BY month DESC
        LIMIT 12
    `).all();

    // Branch breakdown (if Super Admin or Consolidated view)
    const branchBreakdown = db.prepare(`
        SELECT 
            b.id, b.name, b.code,
            COALESCE(SUM(s.total_amount), 0) as gross_sales,
            COALESCE(SUM(s.tax_amount), 0) as output_vat,
            count(s.id) as invoice_count
        FROM branches b
        LEFT JOIN sales s ON b.id = s.branch_id
        GROUP BY b.id
        ORDER BY gross_sales DESC
    `).all();

    res.json({
        vat_rate_percent: 16.0,
        currency: 'KES',
        summary: {
            gross_sales: summary.gross_sales,
            taxable_amount: summary.taxable_amount,
            vat_collected: summary.vat_collected,
            total_invoices: summary.total_invoices
        },
        monthly_trend: monthlyTrend,
        branch_breakdown: branchBreakdown
    });
});

// GET /api/reports/pnl - Comprehensive Branch & Consolidated Profit & Loss
router.get('/pnl', authenticateToken, enforceBranchIsolation, (req, res) => {
    const branchId = req.effectiveBranchId || (req.query.branch_id ? Number(req.query.branch_id) : null);
    const bFilterSales = branchId ? ' WHERE s.branch_id = ' + branchId : '';
    const bFilterExpenses = branchId ? ' WHERE branch_id = ' + branchId : '';

    // 1. Gross Revenue & COGS from sales
    const revenueAndCogs = db.prepare(`
        SELECT 
            COALESCE(SUM(si.total_price), 0) as gross_revenue,
            COALESCE(SUM(si.quantity * p.cost_price), 0) as cogs
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        ${bFilterSales}
    `).get();

    const grossRevenue = revenueAndCogs.gross_revenue;
    const cogs = revenueAndCogs.cogs;
    const grossProfit = grossRevenue - cogs;
    const grossMargin = grossRevenue > 0 ? ((grossProfit / grossRevenue) * 100).toFixed(1) : 0;

    // 2. Operating Expenses by category
    const expenseCategories = db.prepare(`
        SELECT 
            category,
            COALESCE(SUM(amount), 0) as total
        FROM expenses
        ${bFilterExpenses ? bFilterExpenses + " AND status = 'APPROVED'" : "WHERE status = 'APPROVED'"}
        GROUP BY category
    `).all();

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
});

// GET /api/reports/payments - Payment Methods Analysis (M-Pesa, Cash, Card)
router.get('/payments', authenticateToken, enforceBranchIsolation, (req, res) => {
    const branchId = req.effectiveBranchId || (req.query.branch_id ? Number(req.query.branch_id) : null);
    const bFilter = branchId ? ' WHERE s.branch_id = ' + branchId : '';

    const payments = db.prepare(`
        SELECT 
            p.payment_method,
            COALESCE(SUM(p.amount), 0) as total_amount,
            count(p.id) as transaction_count
        FROM payments p
        JOIN sales s ON p.sale_id = s.id
        ${bFilter}
        GROUP BY p.payment_method
    `).all();

    res.json(payments);
});

module.exports = router;

