import crypto from 'crypto';
export const generateOtpEmail = () => {
  const otp = crypto.randomInt(100000, 999999).toString();

  const subject = 'Your OTP Verification Code';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Hello 👋</h2>
      <p>Your One-Time Password (OTP) for email verification is:</p>
      <h1 style="color: #4CAF50;">${otp}</h1>
      <p>This OTP is valid for 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
      <br/>
      <p>Thanks,</p>
      <p>Rahul Gupta</p>
    </div>
  `;

  return { otp, subject, html };
};
