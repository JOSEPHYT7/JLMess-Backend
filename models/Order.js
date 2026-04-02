const mongoose = require('mongoose');

const orderItemSchema = mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Product'
    },
    name: { type: String, required: true },
    qty: { type: Number, required: true },
    price: { type: Number, required: true }
});

const orderSchema = mongoose.Schema({
    items: [orderItemSchema],
    totalAmount: {
        type: Number,
        required: true,
        default: 0.0
    },
    status: {
        type: String,
        enum: ['Pending', 'Preparing', 'Ready', 'Delivered'],
        default: 'Pending'
    },
    tokenNumber: {
        type: String,
        required: true
    },
    isPaid: {
        type: Boolean,
        default: false
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'pending'
    },
    failureReason: {
        type: String
    },
    paymentDetails: {
        orderId: String,
        paymentId: String,
        signature: String
    },
    estimatedTime: {
        type: Number, // In minutes
        required: true,
        default: 10
    }
}, {
    timestamps: true
});

orderSchema.index({ status: 1 });
orderSchema.index({ isPaid: 1, paymentStatus: 1 });
orderSchema.index({ tokenNumber: 1 });
orderSchema.index({ createdAt: -1 });

// Create a TTL index to automatically delete orders older than 30 days
orderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
