// Import modul-modul yang diperlukan
import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { executeQuery } from "../db";
import { Customer } from "../models/Customer";
import { jwtSecret } from "../config";
import { RowDataPacket } from "mysql2";
import nodemailer, { Transporter } from "nodemailer";

const router = express.Router();

async function sendResetPasswordEmail(email: string, resetToken: string) {
  const transporter: Transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'dwiaryasfrllh@gmail.com', 
      pass: 'grpd zwqf roil dslc',
    },
  });

  const mailOptions = {
    from: "dwiaryasfrllh@gmail.com",
    to: email,
    subject: "Reset Password",
    text: `Klik tautan berikut untuk mereset password Anda: http://localhost:5173/reset-password?token=${resetToken}`,
  };

  await transporter.sendMail(mailOptions);
}

router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;
  console.log(email)
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const fetchUserQuery = `
      SELECT id, email FROM customers WHERE email = ?
    `;
    const [user] = await executeQuery<RowDataPacket>(fetchUserQuery, [email]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = jwt.sign({ email: user.email }, jwtSecret, {
      expiresIn: "1h",
    });

    await sendResetPasswordEmail(email, resetToken);
    
    res.status(200).json({ message: "Reset password email sent" });
  } catch (error) {
    console.error("Error sending reset password email: ", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/reset-password", async (req: Request, res: Response) => {
    const { token, newPassword} = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }
    
    try {
      const decoded = jwt.verify(token, jwtSecret);
  
      if (typeof decoded !== 'object' || !('email' in decoded)) {
        return res.status(400).json({ message: "Invalid token" });
      }
  
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await executeQuery(`
        UPDATE customers SET password = ? WHERE email = ?
      `, [hashedPassword, decoded.email]);
  
      res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password: ", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
export default router;
