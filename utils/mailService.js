const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, text, html }) => {
    try {
        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.SYSTEM_EMAIL,
                pass: process.env.SYSTEM_EMAIL_PASSWORD
            }
        });

        await transporter.sendMail({
            from: `"JL Tiffin's System" <${process.env.SYSTEM_EMAIL}>`,
            to,
            subject,
            text,
            html
        });
        
        return true;
    } catch (error) {
        console.error('Email Dispatch Error:', error);
        return false;
    }
};

const sendOTPEmail = async (email, otp, purpose) => {
    let message = '';
    let subject = "🔐 Security Code: JL Tiffin's";

    switch(purpose) {
        case 'admin_register':
            message = `Welcome to the Administrative Panel. To finalize your primary administrator profile, use this OTP: <h3>${otp}</h3> Code expires in 10 minutes.`;
            break;
        case 'admin_login':
            message = `System Access Attempt Detected. Verify your identity with this OTP: <h3>${otp}</h3> If this wasn't you, rotate your terminal keys immediately.`;
            break;
        case 'password_reset':
            message = `Password Restoration Request. Code: <h3>${otp}</h3>. Use this to set a new high-security password.`;
            break;
        case 'staff_invite':
            message = `Invitation to join JL Tiffin's Staff. Create your profile using this code: <h3>${otp}</h3>. Professional access only.`;
            break;
    }

    return await sendEmail({
        to: email,
        subject,
        html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px;">
                <h2 style="color: #3b82f6;">JL Tiffin's Security</h2>
                <p>${message}</p>
                <div style="margin-top: 20px; color: #64748b; font-size: 0.85rem;">This is an automated system alert. Do not share your codes.</div>
            </div>
        `
    });
};

const sendReportEmail = async (email, reportType, stats) => {
    const subject = `📊 ${reportType.toUpperCase()} Business Report: JL Tiffin's`;
    const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // Individual order rows for the logs table
    const orderLogsHtml = stats.orders.map(order => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; font-weight: 800; color: #1e293b;">#${order.tokenNumber}</td>
            <td style="padding: 12px; color: #475569; font-size: 0.9rem;">
                ${order.items.map(item => `${item.name} (${item.qty}x)`).join(', ')}
            </td>
            <td style="padding: 12px; color: #166534; font-weight: 700;">₹${order.totalAmount}</td>
            <td style="padding: 12px; color: #94a3b8; font-size: 0.8rem;">${new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
        </tr>
    `).join('');

    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; background: #f8fafc; color: #334155;">
            <div style="max-width: 700px; margin: 0 auto; background: white; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
                
                <!-- Header -->
                <div style="background: #0f172a; padding: 30px; color: white; text-align: center;">
                    <h1 style="margin: 0; font-size: 1.5rem; text-transform: uppercase; letter-spacing: 2px;">JL Tiffin's System</h1>
                    <div style="margin-top: 5px; opacity: 0.7; font-size: 0.9rem;">${reportType.toUpperCase()} FINANCIAL AUDIT</div>
                </div>

                <div style="padding: 30px;">
                    <!-- Summary Stats -->
                    <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                        <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 15px; text-align: center;">
                            <div style="font-size: 0.75rem; font-weight: 800; color: #166534; text-transform: uppercase;">Total Collected</div>
                            <div style="font-size: 2rem; font-weight: 900; color: #14532d; margin-top: 5px;">₹${stats.periodTotal}</div>
                        </div>
                        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 15px; text-align: center;">
                            <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Closed Orders</div>
                            <div style="font-size: 2rem; font-weight: 900; color: #1e293b; margin-top: 5px;">${stats.periodOrders}</div>
                        </div>
                    </div>

                    <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 0.8rem; font-weight: 700;">GENERIC DISPATCH DATE: ${date}</p>

                    <!-- Logs Table -->
                    <h3 style="margin: 30px 0 15px 0; font-size: 1.1rem; color: #1e293b; border-left: 4px solid #3b82f6; padding-left: 15px;">Transaction Trail</h3>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                    <th style="padding: 12px; text-align: left; font-size: 0.75rem; color: #64748b;">TOKEN</th>
                                    <th style="padding: 12px; text-align: left; font-size: 0.75rem; color: #64748b;">ITEMS</th>
                                    <th style="padding: 12px; text-align: left; font-size: 0.75rem; color: #64748b;">AMOUNT</th>
                                    <th style="padding: 12px; text-align: left; font-size: 0.75rem; color: #64748b;">TIME</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${orderLogsHtml || '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #94a3b8;">No transactions found for this period.</td></tr>'}
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top: 40px; padding: 20px; background: #fffbeb; border-radius: 12px; border: 1px solid #fde68a;">
                        <strong style="color: #92400e; display: block; margin-bottom: 5px;">Security Advisory</strong>
                        <p style="margin: 0; font-size: 0.8rem; color: #b45309; line-height: 1.5;">This report contains sensitive financial data. It was generated automatically via the Admin Dashboard. If you believe this transmission was unauthorized, please terminate your active sessions in the "Logs" tab immediately.</p>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <span style="font-size: 0.7rem; color: #94a3b8; font-weight: 700;">SYSTEM GENERATED AUTOMATION &bull; JL TIFFIN'S ENTERPRISE EDITION</span>
                </div>
            </div>
        </div>
    `;

    return await sendEmail({ to: email, subject, html });
};

module.exports = { sendEmail, sendOTPEmail, sendReportEmail };
