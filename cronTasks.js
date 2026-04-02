const cron = require('node-cron');
const Order = require('./models/Order');
const SystemConfig = require('./models/SystemConfig');
const User = require('./models/User');
const { sendReportEmail } = require('./utils/mailService');

const initCronTasks = () => {
    // Schedule for 7:00 PM IST (19:00 IST) every day
    // IST is UTC + 5:30. So 19:00 IST is 13:30 UTC.
    // Cron schedule: '30 13 * * *' (UTC)
    
    cron.schedule('30 13 * * *', async () => {
        try {
            const config = await SystemConfig.findOne();
            if (!config || !config.autoReportEnabled) return;

            // Find all active admins to send reports to
            const admins = await User.find({ role: 'admin' });
            if (admins.length === 0) return;

            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Fetch orders for today
            const orders = await Order.find({
                createdAt: { $gte: startOfToday },
                paymentStatus: 'success'
            }).sort({ createdAt: -1 });

            // Calculate Period Stats
            const periodTotal = orders.reduce((sum, o) => sum + o.totalAmount, 0);
            const periodOrders = orders.length;

            // Daily History (30 Days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const historyAnalytics = await Order.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                { 
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        totalOrders: { $sum: 1 },
                        successfulOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "success"] }, 1, 0] } },
                        earnings: { $sum: { $cond: [{ $eq: ["$paymentStatus", "success"] }, "$totalAmount", 0] } }
                    }
                },
                { $sort: { _id: -1 } }
            ]);

            const stats = {
                reportType: 'Automated Daily',
                periodTotal,
                periodOrders,
                orders,
                history: historyAnalytics
            };

            // Dispatch to all admins
            for (const admin of admins) {
                await sendReportEmail(admin.email, 'daily', stats);
            }

            console.log(`[CRON] Automated Daily Report dispatched to ${admins.length} admins at 7:00 PM IST.`);
        } catch (err) {
            console.error('[CRON ERROR]', err.message);
        }
    });
};

module.exports = initCronTasks;
