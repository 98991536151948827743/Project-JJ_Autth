import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, required: true }, // consider hashing token in prod
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false },
});

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // optional TTL

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
export default RefreshToken;
