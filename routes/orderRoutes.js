const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, getOrders, getAllOrders, updateOrderStatus, getOrderById, recordFailedPayment, getAnalytics, sendDispatchReport } = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').post(createOrder).get(getOrders);
router.route('/all').get(protect, getAllOrders);
router.route('/analytics').get(protect, admin, getAnalytics);
router.route('/dispatch-report').post(protect, admin, sendDispatchReport);
router.route('/verify-payment').post(verifyPayment);
router.route('/failed-payment').post(recordFailedPayment);
router.route('/:id').get(protect, getOrderById).put(protect, updateOrderStatus);

module.exports = router;
