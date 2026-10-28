import express from "express";
import Razorpay from "razorpay";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") || "*"
}));

// SECURITY: Authentication middleware to verify Supabase JWT
const authenticateRequest = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.replace('Bearer ', '');
  
  try {
    // Verify JWT token with Supabase
    const response = await fetch(`https://jubwzelupbntbetpajqb.supabase.co/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4'
      }
    });

    if (!response.ok) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await response.json();
    req.user = user; // Attach user to request
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Init Razorpay lazily so a missing key doesn't crash the whole function on boot
let razorpayInstance = null;
const getRazorpay = () => {
  if (razorpayInstance) return razorpayInstance;
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return razorpayInstance;
};

// Healthcheck
app.get("/", (_, res) => res.json({ ok: true }));

// Create order - PROTECTED with authentication
app.post("/api/create-order", authenticateRequest, async (req, res) => {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(503).json({ error: "Payments not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET" });
    }

    const { amount } = req.body; // in paise
    if (!amount || amount < 100) {
      return res.status(400).json({ error: "Amount (paise) is required & >= 100" });
    }

    // Validate amount is a reasonable value (prevent abuse)
    if (amount > 100000000) { // Max 1 million INR
      return res.status(400).json({ error: "Amount exceeds maximum allowed" });
    }

    const options = {
      amount: Number(amount),
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        user_id: req.user.id // Track which user created the order
      }
    };

    const order = await razorpay.orders.create(options);
    
    // Audit log
    console.log('Order created:', {
      order_id: order.id,
      user_id: req.user.id,
      amount: amount,
      timestamp: new Date().toISOString()
    });
    
    return res.json(order);
  } catch (err) {
    console.error("Create order error:", err);
    return res.status(500).json({ error: "Failed to create order" });
  }
});

// Verify signature - PROTECTED with authentication
app.post("/api/verify-signature", authenticateRequest, (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: "Payments not configured: set RAZORPAY_KEY_SECRET" });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;
    
    // Audit log
    console.log('Signature verification:', {
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      user_id: req.user.id,
      valid: isValid,
      timestamp: new Date().toISOString()
    });
    
    return res.json({ valid: isValid });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ error: "Verification failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Razorpay server running on http://localhost:${PORT}`);
});
