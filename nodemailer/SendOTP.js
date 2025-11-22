import { transporter } from './nodemailerSetup.js';
import { generateOtpEmail } from './GenerateOTPMail.js';
import User from '../models/user.model.js';
import OTP from '../models/otp.model.js';

export const sendOtpToUser = async (email) => {
  try {
    // 1. Find the user
    const user = await User.findOne({ email });
    if (!user) throw new Error("User not found");

    // 2. Generate OTP email content
    const { otp, subject, html } = generateOtpEmail();

    // 3. Create/Replace OTP entry
    //    Delete old OTP (if exists)
    if (user.otpRef) {
      await OTP.findByIdAndDelete(user.otpRef);
    }

    // 4. Create new OTP document
    const newOtp = await OTP.create({
      user: user._id,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // 5. Save reference to user
    user.otpRef = newOtp._id;
    await user.save();

    // 6. Pick a random transporter (your logic)
    const mailer = transporter();

    // 7. Setup mail
    const mailOptions = {
      from: `"Findex" <${mailer.options.auth.user}>`,
      to: email,
      subject,
      html,
    };
    //make sure to change it to unverified email after otp is sent
    user.isEmailVerified = false;
    await user.save();

    // 8. Send email
    await mailer.sendMail(mailOptions);
    console.log(`📩 OTP sent to ${email} from ${mailer.options.auth.user}`);

    return otp;
  } catch (err) {
    console.error("❌ Email failed:", err.message);
    throw new Error("Failed to send OTP");
  }
};
