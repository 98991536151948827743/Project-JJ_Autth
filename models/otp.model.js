import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    otp: {
      type: String,
      required: true,
    },

    // Auto-delete after 5 minutes
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: "5m" },
    },
  },
  { timestamps: true }
);

const OTP = mongoose.model("OTP", otpSchema);
export default OTP;
