const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const resetAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tiffin-center');
        console.log("Connected to Audit Database... 🕵️‍♂️");

        const admins = await User.find({ role: 'admin' });
        
        if (admins.length > 0) {
            console.log(`Detected ${admins.length} Administrative profile(s).`);
            const res = await User.deleteMany({ role: 'admin' });
            console.log(`Audit Success: ${res.deletedCount} Admin(s) purged from the secure records.`);
        } else {
            console.log("No Administrative profiles currently exist in the system registry.");
        }

        process.exit(0);
    } catch (error) {
        console.error("Critical Registry Fault:", error);
        process.exit(1);
    }
};

resetAdmin();
