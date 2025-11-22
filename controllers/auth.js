import User from "../models/user.model.js";
import OTP from "../models/otp.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import { sendOtpToUser } from "../nodemailer/SendOTP.js";
import { signAccessToken, createRefreshToken, verifyRefreshToken } from "../utils/token.js";



const OTP_RESEND_MIN_SECONDS = 60; // throttle: 1 minute between OTPs
const ACCESS_TOKEN_COOKIE_NAME = "refresh_token"; // we'll store refresh token as httpOnly cookie

// helper: sanitize user object before sending to client
const sanitizeUser = (userDoc) => {
  if (!userDoc) return null;
  const user = userDoc.toObject ? userDoc.toObject() : userDoc;
  // keep only safe fields
  const { _id, fullName, email, college, branch, year, rollNumber, avatar, role, isEmailVerified, createdAt, updatedAt } = user;
  return { _id, fullName, email, college, branch, year, rollNumber, avatar, role, isEmailVerified, createdAt, updatedAt };
};

// STEP 1 — REQUEST OTP
export const requestOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        fullName: "New User",
        email,
        college: "Unknown",
      });
    }

    // Throttle: if existing OTP has been created less than OTP_RESEND_MIN_SECONDS ago, refuse
    if (user.otpRef) {
      const existingOtp = await OTP.findById(user.otpRef);
      if (existingOtp) {
        const secondsSince = (Date.now() - existingOtp.createdAt) / 1000;
        if (secondsSince < OTP_RESEND_MIN_SECONDS) {
          return res.status(429).json({ message: `Please wait ${Math.ceil(OTP_RESEND_MIN_SECONDS - secondsSince)}s before requesting another OTP.` });
        }
      }
    }

    // sendOtpToUser will create OTP doc, delete old one and set user.otpRef
    await sendOtpToUser(email);

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("requestOTP error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};


// STEP 2 — VERIFY OTP & SIGN TOKENS
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

    // include otpRef in user
    const user = await User.findOne({ email }).populate("otpRef");
    if (!user) return res.status(404).json({ message: "User not found" });

    const otpDoc = user.otpRef;
    if (!otpDoc) return res.status(400).json({ message: "No OTP found — request one first" });

    // check expiration
    if (otpDoc.expiresAt < new Date()) {
      await OTP.findByIdAndDelete(otpDoc._id).catch(() => {});
      user.otpRef = null;
      await user.save();
      return res.status(400).json({ message: "OTP expired; please request a new one" });
    }

    // check otp match (constant-time compare recommended in prod)
    if (otpDoc.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // OTP valid: remove OTP doc and clear ref
    await OTP.findByIdAndDelete(otpDoc._id);
    user.otpRef = null;
    if (!user.isEmailVerified) user.isEmailVerified = true;
    await user.save();

    // Issue tokens
    const accessToken = signAccessToken(user._id);
    const refreshToken = createRefreshToken(user._id);

    // Persist refresh token server-side for revocation (expires in 7 days here)

    // Set refresh token as httpOnly cookie
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const isNewProfile = user.fullName === "New User" || !user.college || user.college === "Unknown";

    return res.status(200).json({
      message: "OTP verified successfully",
      accessToken,
      user: sanitizeUser(user),
      redirectToProfileSetup: isNewProfile,
    });
  } catch (err) {
    console.error("verifyOTP error:", err);
    return res.status(500).json({ message: "Failed to verify OTP" });
  }
};


// Create or update profile — safe endpoint (expects access token middleware to set req.userId)
// Accepts either req.userId (preferred) or userId in body (less secure)
export const createOrUpdateProfile = async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    const { fullName, college, branch, year, rollNumber, avatar } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!fullName || !college) {
      return res.status(400).json({ message: "fullName and college are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // update allowed fields
    user.fullName = fullName;
    user.college = college;
    if (branch) user.branch = branch;
    if (year) user.year = year;
    if (rollNumber) user.rollNumber = rollNumber;
    if (avatar) user.avatar = avatar;
    // optionally mark verified true when profile completed
    if (!user.isEmailVerified) user.isEmailVerified = true;

    await user.save();

    return res.status(200).json({ message: "Profile saved", user: sanitizeUser(user) });
  } catch (err) {
    console.error("createOrUpdateProfile error:", err);
    return res.status(500).json({ message: "Failed to save profile" });
  }
};


// REFRESH ACCESS TOKEN endpoint — uses refresh token cookie or accepts token in body
export const refreshToken = async (req, res) => {
  try {
    const tokenFromCookie = req.cookies?.[ACCESS_TOKEN_COOKIE_NAME];
    const token = tokenFromCookie || req.body.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token provided" });

    // verify token signature & payload
    const payload = await verifyRefreshToken(token).catch(() => null);
    if (!payload || !payload.userId) return res.status(401).json({ message: "Invalid refresh token" });

    // check token stored and not revoked
    const stored = await RefreshToken.findOne({ user: payload.userId, token, revoked: false });
    if (!stored) return res.status(401).json({ message: "Refresh token revoked or not found" });

    // check expiry
    if (stored.expiresAt < new Date()) {
      stored.revoked = true;
      await stored.save();
      return res.status(401).json({ message: "Refresh token expired" });
    }

    // all good — issue new access token (optionally rotate refresh token)
    const accessToken = signAccessToken(payload.userId);

    return res.status(200).json({ accessToken });
  } catch (err) {
    console.error("refreshToken error:", err);
    return res.status(500).json({ message: "Failed to refresh token" });
  }
};


// LOGOUT — revoke refresh token (cookie)
export const logout = async (req, res) => {
  try {
    const tokenFromCookie = req.cookies?.[ACCESS_TOKEN_COOKIE_NAME];
    const tokenFromBody = req.body.refreshToken;
    const token = tokenFromCookie || tokenFromBody;
    if (token) {
      // mark token revoked if exists
      await RefreshToken.findOneAndUpdate({ token }, { revoked: true }).catch(() => {});
    }

    // clear cookie
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, { path: "/" });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ message: "Failed to logout" });
  }
};


// Get current user profile (expects authentication middleware to set req.userId)
export const getProfile = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("getProfile error:", err);
    return res.status(500).json({ message: "Failed to fetch profile" });
  }
};
