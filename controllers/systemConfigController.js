const SystemConfig = require('../models/SystemConfig');

const getConfig = async (req, res) => {
    try {
        let config = await SystemConfig.findOne();
        if (!config) {
            config = await SystemConfig.create({
                isOrderingEnabled: true,
                message: 'Currently not accepting orders, please try later'
            });
        }
        const response = config.toObject();
        response.razorpayKey = process.env.RAZORPAY_KEY_ID === 'YOUR_RAZORPAY_KEY_ID' ? null : process.env.RAZORPAY_KEY_ID;
        res.json(response);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateConfig = async (req, res) => {
    try {
        const { isOrderingEnabled, message, autoReportEnabled } = req.body;
        let config = await SystemConfig.findOne();

        if (config) {
            config.isOrderingEnabled = isOrderingEnabled !== undefined ? isOrderingEnabled : config.isOrderingEnabled;
            config.message = message !== undefined ? message : config.message;
            config.autoReportEnabled = autoReportEnabled !== undefined ? autoReportEnabled : config.autoReportEnabled;
            const updatedConfig = await config.save();
            res.json(updatedConfig);
        } else {
            res.status(404).json({ message: 'Config not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getConfig, updateConfig };
