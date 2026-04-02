const mongoose = require('mongoose');

const loginLogSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    email: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true
    },
    loginTime: {
        type: Date,
        default: Date.now
    },
    deviceInfo: {
        browser: String,
        os: String,
        deviceType: String 
    },
    ip: {
        type: String
    },
    status: {
        type: String,
        enum: ['success', 'failed'],
        required: true
    },
    failureReason: String
}, {
    timestamps: true
});

loginLogSchema.index({ loginTime: -1 });
loginLogSchema.index({ email: 1 });
loginLogSchema.index({ status: 1 });

const LoginLog = mongoose.model('LoginLog', loginLogSchema);
module.exports = LoginLog;
