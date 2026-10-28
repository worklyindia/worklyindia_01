import express from 'express';
import nodemailer from 'nodemailer';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://jubwzelupbntbetpajqb.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Authentication middleware
const authenticateRequest = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required. Please provide a valid authorization token.' 
      });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired authentication token.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Authentication failed.' 
    });
  }
};

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:5173", "https://localhost:5173", "https://*.lovableproject.com"]
}));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Gmail server running', timestamp: new Date().toISOString() });
});

// Verify Gmail credentials (protected)
app.post('/api/verify-gmail', authenticateRequest, async (req, res) => {
  try {
    const { email, password, useServerCredentials } = req.body;

    // Use server credentials if requested and available
    const authEmail = (useServerCredentials && process.env.SMTP_USER) ? process.env.SMTP_USER : email;
    const authPassword = (useServerCredentials && process.env.SMTP_PASS) ? process.env.SMTP_PASS : password;

    if (!authEmail || !authPassword) {
      return res.status(400).json({ 
        success: false, 
        error: useServerCredentials ? 'Server credentials not configured' : 'Email and password are required' 
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: authEmail,
        pass: authPassword,
      },
    });

    await transporter.verify();
    
    console.log(`[AUDIT] Gmail credentials verified by user: ${req.user.id}`);
    res.json({ success: true, message: 'Gmail credentials verified successfully' });
  } catch (error) {
    console.error('Gmail verification error:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message || 'Failed to verify Gmail credentials'
    });
  }
});

// Send email with attachments (protected)
app.post('/api/send-email', authenticateRequest, upload.fields([
  { name: 'brandLogo', maxCount: 1 },
  { name: 'attachments', maxCount: 10 }
]), async (req, res) => {
  try {
    const { email, password, fromName, to, subject, html, text, useServerCredentials } = req.body;
    
    // Use server credentials if requested and available
    const authEmail = (useServerCredentials === 'true' && process.env.SMTP_USER) ? process.env.SMTP_USER : email;
    const authPassword = (useServerCredentials === 'true' && process.env.SMTP_PASS) ? process.env.SMTP_PASS : password;
    
    if (!authEmail || !authPassword || !to || !subject) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, to, or subject'
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: authEmail,
        pass: authPassword,
      },
    });

    // Prepare mail options
    const mailOptions = {
      from: fromName ? `"${fromName}" <${authEmail}>` : authEmail,
      to: to,
      subject: subject,
      html: html || undefined,
      text: text || undefined,
      attachments: [],
    };

    // Handle brand logo as embedded image
    const files = req.files;
    if (files && files.brandLogo && files.brandLogo[0]) {
      const brandLogo = files.brandLogo[0];
      mailOptions.attachments.push({
        filename: brandLogo.originalname,
        content: brandLogo.buffer,
        cid: 'brand-logo', // For embedding in HTML
      });
    }

    // Handle regular attachments
    if (files && files.attachments) {
      files.attachments.forEach((file) => {
        mailOptions.attachments.push({
          filename: file.originalname,
          content: file.buffer,
        });
      });
    }

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`[AUDIT] Email sent by user ${req.user.id} to ${to}, messageId: ${info.messageId}`);
    
    res.json({
      success: true,
      messageId: info.messageId,
      message: 'Email sent successfully'
    });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email'
    });
  }
});

// Send simple email without files (protected)
app.post('/api/send-simple-email', authenticateRequest, async (req, res) => {
  try {
    const { email, password, fromName, to, subject, html, text, useServerCredentials } = req.body;
    
    // Use server credentials if requested and available
    const authEmail = (useServerCredentials && process.env.SMTP_USER) ? process.env.SMTP_USER : email;
    const authPassword = (useServerCredentials && process.env.SMTP_PASS) ? process.env.SMTP_PASS : password;
    
    if (!authEmail || !authPassword || !to || !subject) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: authEmail,
        pass: authPassword,
      },
    });

    const mailOptions = {
      from: fromName ? `"${fromName}" <${authEmail}>` : authEmail,
      to: to,
      subject: subject,
      html: html || undefined,
      text: text || undefined,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`[AUDIT] Simple email sent by user ${req.user.id} to ${to}, messageId: ${info.messageId}`);
    
    res.json({
      success: true,
      messageId: info.messageId,
      message: 'Email sent successfully'
    });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email'
    });
  }
});

const PORT = process.env.GMAIL_SERVER_PORT || 5001;
app.listen(PORT, () => {
  console.log(`Gmail server running on http://localhost:${PORT}`);
});