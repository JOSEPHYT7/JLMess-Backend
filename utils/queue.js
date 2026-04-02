// Stub queue utility — no-op, zero dependencies.
// BullMQ/Redis has been removed. All emails are sent directly.

const { sendOTPEmail } = require('./mailService');

const addEmailJob = async (jobName, data) => {
    try {
        await sendOTPEmail(data.email, data.otp, data.purpose);
    } catch (err) {
        console.error('Email send failed:', err.message);
    }
};

module.exports = { addEmailJob };
