import e from "express";
import jwt from "jsonwebtoken";

const authenticateAccessToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: Token missing" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized: Token missing" });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // attach userId to request
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
  }
};
export { authenticateAccessToken };
