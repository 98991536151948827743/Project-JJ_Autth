import express from "express";
import cookieParser from "cookie-parser";
import { requestOTP, verifyOTP, createOrUpdateProfile, refreshToken, logout, getProfile } from "../controllers/auth.js"
import { authenticateAccessToken } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(cookieParser());

router.post("/send-otp", requestOTP);
router.post("/verify-otp", verifyOTP);
router.post("/profile", authenticateAccessToken, createOrUpdateProfile); // authenticated
router.get("/me", authenticateAccessToken, getProfile);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);

export default router;
