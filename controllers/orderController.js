const Order = require('../models/Order');
const SystemConfig = require('../models/SystemConfig');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Utility to generate token
const generateTokenNumber = async () => {
    let config = await SystemConfig.findOne();
    if (!config) {
        config = await SystemConfig.create({});
    }

    // Calculate precise India Standard Time (IST: UTC + 5:30)
    const istTimeMs = Date.now() + (5.5 * 60 * 60 * 1000);

    // Roll back exactly 5 hours so the "Date" mathematically flips at 05:00 AM IST instead of midnight
    const businessDateMs = istTimeMs - (5 * 60 * 60 * 1000);
    const businessDay = new Date(businessDateMs).toISOString().split('T')[0];

    if (config.lastTokenDate !== businessDay) {
        config.lastToken = 100;
        config.lastTokenDate = businessDay;
    } else {
        if (config.lastToken >= 999) {
            config.lastToken = 100; // Loop back if we hit the limit
        } else {
            config.lastToken += 1;
        }
    }

    await config.save();

    // Return formatted as strict 3 digits ('118', '119', etc)
    return String(config.lastToken).padStart(3, '0');
};

const createOrder = async (req, res) => {
    try {
        const { items, totalAmount } = req.body;

        if (items && items.length === 0) {
            return res.status(400).json({ message: 'No order items' });
        }

        const config = await SystemConfig.findOne();
        if (config && !config.isOrderingEnabled) {
            return res.status(400).json({ message: config.message });
        }

        const tokenNumber = await generateTokenNumber();

        // Smart Dynamic Estimation Logic
        const activeOrdersCount = await Order.countDocuments({ status: { $ne: 'Delivered' } });
        const totalPlates = items.reduce((sum, item) => sum + item.qty, 0);
        const estimatedTime = Math.max(4, (totalPlates * 4) + (activeOrdersCount * 2));

        const order = new Order({
            items,
            totalAmount,
            tokenNumber,
            estimatedTime,
            status: 'Pending'
        });

        // Initialize Razorpay
        let rpOrder = { id: `mock_order_${order._id}` };

        const hasRazorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'YOUR_RAZORPAY_KEY_ID';

        if (hasRazorpay) {
            const instance = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
            });

            const options = {
                amount: totalAmount * 100, // amount in smallest currency unit
                currency: "INR",
                receipt: `${order._id}`
            };

            rpOrder = await instance.orders.create(options);
        }

        order.paymentDetails = { orderId: rpOrder.id };
        const createdOrder = await order.save();

        res.status(201).json({
            order: createdOrder,
            razorpayOrder: rpOrder
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        let isValid = false;

        if (razorpay_signature === 'mock_signature') {
            isValid = true;
        } else if (process.env.RAZORPAY_KEY_SECRET) {
            const sign = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSign = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(sign.toString())
                .digest("hex");
            isValid = (razorpay_signature === expectedSign);
        }

        if (isValid) {
            const order = await Order.findOne({ 'paymentDetails.orderId': razorpay_order_id });
            if (order) {
                order.isPaid = true;
                order.paymentStatus = 'success';
                order.paymentDetails.paymentId = razorpay_payment_id;
                order.paymentDetails.signature = razorpay_signature;
                await order.save();

                // Emitting new order event
                const io = req.app.get('socketio');
                if (io) {
                    io.emit('newOrder', order);
                }

                return res.status(200).json({ message: "Payment verified successfully", order });
            }
        } else {
            return res.status(400).json({ message: "Invalid signature sent!" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const recordFailedPayment = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        // orderId here is the mongo ID if they couldn't even reach razorpay backend validation, or the razorpay order_id
        const order = await Order.findById(orderId).catch(() => null) || await Order.findOne({ 'paymentDetails.orderId': orderId });

        if (order) {
            order.paymentStatus = 'failed';
            order.failureReason = reason || 'User abandoned or transaction failed';
            await order.save();
            return res.status(200).json({ message: 'Failed payment recorded logging' });
        }
        res.status(404).json({ message: 'Order not found' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getAnalytics = async (req, res) => {
    try {
        // We aggregate by day for the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const analytics = await Order.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
                    totalOrders: { $sum: 1 },
                    successfulOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "success"] }, 1, 0] } },
                    failedOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "failed"] }, 1, 0] } },
                    earnings: { $sum: { $cond: [{ $eq: ["$paymentStatus", "success"] }, "$totalAmount", 0] } }
                }
            },
            { $sort: { _id: -1 } }
        ]);

        // Get today's date in IST
        const todayRaw = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000)).toISOString().split('T')[0];

        res.json({
            history: analytics,
            todayStats: analytics.find(a => a._id === todayRaw) || { totalOrders: 0, successfulOrders: 0, failedOrders: 0, earnings: 0 }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getOrders = async (req, res) => {
    try {
        // Fetch only today's unpaid orders? No, active orders.
        const orders = await Order.find({ status: { $ne: 'Delivered' }, isPaid: true }).sort({ createdAt: 1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find({}).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id);

        if (order) {
            order.status = status;
            const updatedOrder = await order.save();

            // Emit to sockets
            const io = req.app.get('socketio');
            if (io) {
                io.emit('orderUpdated', updatedOrder);
            }

            res.json(updatedOrder);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (order) {
            res.json(order);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const { sendReportEmail } = require('../utils/mailService');

const sendDispatchReport = async (req, res) => {
    try {
        const { reportType } = req.body; // 'daily', 'weekly', 'monthly'

        // Calculate the exact start of today in Asia/Kolkata
        // We use UTC offset 5.5 hours
        const now = new Date();
        const serverOffsetMs = now.getTimezoneOffset() * 60000;
        const istOffsetMs = 5.5 * 3600000;

        const localNow = new Date(now.getTime() + serverOffsetMs + istOffsetMs);
        let startDate = new Date(localNow);
        startDate.setHours(0, 0, 0, 0);

        // Convert that local 00:00 back to a global UTC Date for Mongoose query
        const utcStartDate = new Date(startDate.getTime() - istOffsetMs);

        if (reportType === 'weekly') {
            utcStartDate.setDate(utcStartDate.getDate() - 7);
        } else if (reportType === 'monthly') {
            utcStartDate.setDate(utcStartDate.getDate() - 30);
        }

        // Fetch detailed orders for the period
        const orders = await Order.find({
            createdAt: { $gte: utcStartDate },
            paymentStatus: 'success'
        }).sort({ createdAt: -1 });

        // Aggregate stats for the period
        const periodTotal = orders.reduce((sum, o) => sum + o.totalAmount, 0);
        const periodOrders = orders.length;

        // Daily stats for the history table (30 days) using IST grouping
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const analytics = await Order.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
                    totalOrders: { $sum: 1 },
                    successfulOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "success"] }, 1, 0] } },
                    failedOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "failed"] }, 1, 0] } },
                    earnings: { $sum: { $cond: [{ $eq: ["$paymentStatus", "success"] }, "$totalAmount", 0] } }
                }
            },
            { $sort: { _id: -1 } }
        ]);

        const stats = {
            reportType,
            periodTotal,
            periodOrders,
            orders, // The detailed list
            history: analytics // The daily summary
        };

        const adminEmail = req.user.email;
        const success = await sendReportEmail(adminEmail, reportType, stats);

        if (success) {
            res.json({ message: `Full ${reportType} report dispatched to ${adminEmail}` });
        } else {
            res.status(500).json({ message: 'Mail server dispatch failed' });
        }

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { createOrder, verifyPayment, recordFailedPayment, getAnalytics, getOrders, getAllOrders, updateOrderStatus, getOrderById, sendDispatchReport };
