const mongoose = require('mongoose');

const productSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    available: {
        type: Boolean,
        default: true
    },
    image: {
        type: String,
        default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80'
    }
}, {
    timestamps: true
});

productSchema.index({ available: 1 });
productSchema.index({ name: 'text' }); // For future search refinement

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
