// server.js
import express from "express";
import { getClarityData } from "./clarityApi.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = 3000;

// SECURITY: Authentication middleware to verify Supabase JWT
const supabase = createClient(
  "https://jubwzelupbntbetpajqb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"
);

const authenticateRequest = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.replace('Bearer ', '');
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// PROTECTED: Require authentication for Clarity data
app.get("/api/clarity-data", authenticateRequest, async (req, res) => {
  const data = await getClarityData();
  if (data) {
    res.json(data);
  } else {
    res.status(500).json({ error: "Clarity data fetch failed" });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
