const mongoose = require('mongoose');

const systemConfigSchema = mongoose.Schema({
    isOrderingEnabled: {
        type: Boolean,
        default: true
    },
    message: {
        type: String,
        default: 'Currently not accepting orders, please try later'
    },
    lastToken: {
        type: Number,
        default: 100
    },
    lastTokenDate: {
        type: String // YYYY-MM-DD to reset daily
    },
    autoReportEnabled: {
        type: Boolean,
        default: false
    }
});

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);
module.exports = SystemConfig;
