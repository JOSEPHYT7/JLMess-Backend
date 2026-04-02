const User = require('../models/User');
const OTP = require('../models/OTP');
const LoginLog = require('../models/LoginLog');
const jwt = require('jsonwebtoken');
const useragent = require('useragent');
const { addEmailJob } = require('../utils/queue');
const { deleteCache } = require('../utils/redis');

const generateToken = (id, tokenVersion = 0) => {
    return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// --- LOGGING HELPER ---
const logAttempt = async (req, email, role, status, userId = null, reason = '') => {
    const agent = useragent.parse(req.headers['user-agent']);
    await LoginLog.create({
        userId,
        email,
        role,
        status,
        failureReason: reason,
        ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        deviceInfo: {
            browser: agent.toAgent(),
            os: agent.os.toString(),
            deviceType: agent.device.toString()
        }
    });
};

// --- ADMIN FIRST SETUP ---
const checkAdminStatus = async (req, res) => {
    try {
        const adminCount = await User.countDocuments({ role: 'admin' });
        res.json({ adminExists: adminCount > 0 });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const setupFirstAdminRequest = async (req, res) => {
    try {
        const { email } = req.body;
        const adminExists = await User.exists({ role: 'admin' });
        if (adminExists) return res.status(403).json({ message: 'Primary Administrative Access already established.' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.findOneAndUpdate(
            { email, purpose: 'admin_register' },
            { otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000), verified: false },
            { upsert: true }
        );

        await addEmailJob('admin_reg_otp', { email, otp, purpose: 'admin_register' });

        res.json({ message: 'Audit code dispatched to system email.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const verifyFirstAdmin = async (req, res) => {
    try {
        const { name, email, password, otp } = req.body;
        const otpRecord = await OTP.findOne({ email, otp, purpose: 'admin_register', verified: false });

        if (!otpRecord || otpRecord.expiresAt < new Date()) {
            return res.status(401).json({ message: 'Security token invalid or expired.' });
        }

        const user = await User.create({ name, email, password, role: 'admin' });
        await OTP.deleteOne({ _id: otpRecord._id });

        await logAttempt(req, email, 'admin', 'success', user._id);
        
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id, user.tokenVersion)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- ADMIN LOGIN (2-STEP) ---
const adminLoginStep1 = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, role: 'admin' });

        if (user && (await user.matchPassword(password))) {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            await OTP.findOneAndUpdate(
                { email, purpose: 'admin_login' },
                { otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000), verified: false },
                { upsert: true }
            );

            await addEmailJob('admin_login_otp', { email, otp, purpose: 'admin_login' });
            res.json({ message: 'Verification code dispatched.', email });
        } else {
            await logAttempt(req, email, 'admin', 'failed', null, 'Invalid credentials');
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const adminLoginStep2 = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const otpRecord = await OTP.findOne({ email, otp, purpose: 'admin_login', verified: false });

        if (!otpRecord || otpRecord.expiresAt < new Date()) {
            return res.status(401).json({ message: 'Verification failed.' });
        }

        const user = await User.findOne({ email, role: 'admin' });
        user.activeSessions += 1;
        await user.save();

        await OTP.deleteOne({ _id: otpRecord._id });
        await logAttempt(req, email, 'admin', 'success', user._id);

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id, user.tokenVersion)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- STAFF LOGIN ---
const staffLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, role: 'staff' });

        if (user && (await user.matchPassword(password))) {
            user.activeSessions += 1;
            await user.save();
            await logAttempt(req, email, 'staff', 'success', user._id);

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, user.tokenVersion)
            });
        } else {
            await logAttempt(req, email, email, 'failed', null, 'Invalid staff credentials');
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- LOGGING REPORTS ---
const getDashboardLogs = async (req, res) => {
    try {
        const logs = await LoginLog.find({})
            .sort({ loginTime: -1 })
            .limit(100);
        
        const today = new Date();
        today.setHours(0,0,0,0);

        const stats = {
            todayTotal: await LoginLog.countDocuments({ loginTime: { $gte: today }, status: 'success' }),
            todayFailed: await LoginLog.countDocuments({ loginTime: { $gte: today }, status: 'failed' })
        };

        res.json({ logs, stats });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- ORIGINAL ADMIN FUNCTIONS MODIFIED ---
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({ role: 'staff' }).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user && user.role === 'staff') {
            await User.deleteOne({ _id: user._id });
            res.json({ message: 'Staff profile purged.' });
        } else {
            res.status(404).json({ message: 'Target profile not found or is protected.' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const inviteStaffRequest = async (req, res) => {
    try {
        const { email } = req.body;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.findOneAndUpdate({ email, purpose: 'staff_invite' }, { otp, expiresAt: new Date(Date.now() + 24*60*60*1000), verified: false }, { upsert: true });
        await addEmailJob('staff_invite_otp', { email, otp, purpose: 'staff_invite' });
        res.json({ message: 'Invitation dispatched.' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

const logoutUser = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user && user.activeSessions > 0) {
            user.activeSessions -= 1;
            await user.save();
        }
        res.json({ message: 'Audit logout successful.' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

const verifyStaffInvite = async (req, res) => {
    try {
        const { name, email, password, otp } = req.body;
        const otpRecord = await OTP.findOne({ email, otp, purpose: 'staff_invite', verified: false });

        if (!otpRecord || otpRecord.expiresAt < new Date()) {
            return res.status(401).json({ message: 'Invitation code invalid or has expired.' });
        }

        const user = await User.create({ name, email, password, role: 'staff' });
        await OTP.deleteOne({ _id: otpRecord._id });

        await logAttempt(req, email, 'staff', 'success', user._id, 'Initial Setup Complete');
        
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id, user.tokenVersion)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const logoutAllDevices = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();
        res.json({ message: 'All remote sessions invalidated.' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// --- FORGOT PASSWORD SYSTEM ---
const forgotPasswordRequest = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'System could not locate a profile with that identity.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.findOneAndUpdate(
            { email, purpose: 'password_reset' },
            { otp, expiresAt: new Date(Date.now() + 15 * 60 * 1000), verified: false },
            { upsert: true }
        );

        await addEmailJob('password_reset_otp', { email, otp, purpose: 'password_reset' });
        res.json({ message: 'A restoration code has been dispatched to your registered email.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const otpRecord = await OTP.findOne({ email, otp, purpose: 'password_reset', verified: false });

        if (!otpRecord || otpRecord.expiresAt < new Date()) {
            return res.status(401).json({ message: 'Verification failed. Code is invalid or expired.' });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User no longer exists.' });

        user.password = newPassword;
        user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate current tech sessions
        await user.save();

        await OTP.deleteOne({ _id: otpRecord._id });
        await logAttempt(req, email, user.role, 'success', user._id, 'Password Reset via OTP');

        res.json({ message: 'Identity restored. Password has been recalculated.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { 
    checkAdminStatus, setupFirstAdminRequest, verifyFirstAdmin,
    adminLoginStep1, adminLoginStep2, staffLogin, 
    getDashboardLogs, getAllUsers, deleteUser, logoutUser,
    inviteStaffRequest, verifyStaffInvite, logoutAllDevices,
    forgotPasswordRequest, resetPassword
};
