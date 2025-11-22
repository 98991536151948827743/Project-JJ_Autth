import jwt from "jsonwebtoken";
import crypto from "crypto";
import RefreshToken from "../models/refreshToken.model.js"; // if you’re storing RTs in DB

// ===========================
//  CONFIG
// ===========================
const ACCESS_TOKEN_EXPIRY = "15m";       // short-lived — safe
const REFRESH_TOKEN_EXPIRY_DAYS = 7;     // rotates every 7 days
const HASH_REFRESH_TOKENS = true;        // set false if you want plain tokens (not recommended)


// ===========================
//  GENERATE ACCESS TOKEN
// ===========================
export const signAccessToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};


// ===========================
//  GENERATE REFRESH TOKEN (raw string)
// ===========================
export const generateRawRefreshToken = () => {
  // cryptographically strong token
  return crypto.randomBytes(64).toString("hex");
};


// ===========================
//  HASH REFRESH TOKEN (DB storage)
// ===========================
export const hashRefreshToken = (token) => {
  if (!HASH_REFRESH_TOKENS) return token;
  return crypto.createHash("sha256").update(token).digest("hex");
};


// ===========================
//  SIGN & STORE REFRESH TOKEN IN DATABASE
// ===========================
export const createRefreshToken = async (userId) => {
  const rawToken = generateRawRefreshToken();
  const hashedToken = hashRefreshToken(rawToken);

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user: userId,
    token: hashedToken,
    expiresAt,
    revoked: false,
  });

  return rawToken; // return raw token to the client
};


// ===========================
//  VERIFY ACCESS TOKEN
// ===========================
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch {
    return null; // invalid / expired
  }
};


// ===========================
//  VERIFY REFRESH TOKEN
// ===========================
export const verifyRefreshToken = async (rawToken) => {
  try {
    const hashed = hashRefreshToken(rawToken);

    const stored = await RefreshToken.findOne({
      token: hashed,
      revoked: false,
    });

    if (!stored) return null;

    if (stored.expiresAt < new Date()) {
      stored.revoked = true;
      await stored.save();
      return null;
    }

    return stored; // good token
  } catch {
    return null;
  }
};


// ===========================
//  ROTATE REFRESH TOKEN (Best Practice)
// ===========================
export const rotateRefreshToken = async (oldRawToken, userId) => {
  const hashedOld = hashRefreshToken(oldRawToken);

  // revoke old token
  await RefreshToken.findOneAndUpdate(
    { token: hashedOld },
    { revoked: true }
  ).catch(() => {});

  // issue new
  return await createRefreshToken(userId);
};


// ===========================
//  ISSUE BOTH TOKENS TOGETHER
// ===========================
export const generateAuthTokens = async (userId) => {
  const accessToken = signAccessToken(userId);
  const refreshToken = await createRefreshToken(userId);

  return { accessToken, refreshToken };
};
