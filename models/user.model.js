import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    college: {
      type: String,
      required: true,
      trim: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // Reference to OTP collection
    otpRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OTP",
      default: null,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
