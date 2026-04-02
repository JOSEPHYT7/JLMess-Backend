const express = require('express');
const router = express.Router();
const { 
    checkAdminStatus, setupFirstAdminRequest, verifyFirstAdmin,
    adminLoginStep1, adminLoginStep2, staffLogin, 
    getDashboardLogs, getAllUsers, deleteUser, logoutUser,
    inviteStaffRequest, verifyStaffInvite, logoutAllDevices,
    forgotPasswordRequest, resetPassword
} = require('../controllers/authController');
const { protect, admin } = require('../middleware/authMiddleware');

// --- PUBLIC ---
router.get('/check-admin', checkAdminStatus);
router.post('/admin/register-otp', setupFirstAdminRequest);
router.post('/admin/verify-register', verifyFirstAdmin);

router.post('/admin/login', adminLoginStep1);
router.post('/admin/verify-login', adminLoginStep2);

router.post('/staff/login', staffLogin);
router.post('/staff/verify-invite', verifyStaffInvite);

// --- FORGOT PASSWORD ---
router.post('/forgot-password', forgotPasswordRequest);
router.post('/reset-password', resetPassword);

// --- PROTECTED ---
router.post('/logout', protect, logoutUser);
router.get('/profile', protect, (req, res) => res.json(req.user)); // Inline simple profile

// --- ADMIN ONLY ---
router.get('/logs', protect, admin, getDashboardLogs);
router.get('/users', protect, admin, getAllUsers);
router.post('/invite-staff', protect, admin, inviteStaffRequest);
router.post('/users/:id/logout-all', protect, admin, logoutAllDevices);
router.delete('/users/:id', protect, admin, deleteUser);

module.exports = router;
