-- Insert default merchant information settings
INSERT INTO site_settings (key, value, updated_by)
VALUES 
  ('merchant_info', '{
    "legal_name": "VISHALBHAI MULJIBHAI GOHIL",
    "contact_number": "+91 9904923067",
    "email": "Workly India.india.24×7@gmail.com",
    "registered_address": "Gohil sheri, Sankhewsar, Patan, Gujarat, India - 384246",
    "operational_address": "Gohil sheri, Sankhewsar, Patan, Gujarat, India - 384246"
  }'::jsonb, NULL)
ON CONFLICT (key) DO NOTHING;

-- Insert default contact information settings
INSERT INTO site_settings (key, value, updated_by)
VALUES 
  ('contact_info', '{
    "phone": "+91 9904923067",
    "phone_hours": "Mon-Fri, 9 AM - 6 PM",
    "email": "Workly India.india.24×7@gmail.com",
    "email_response": "24/7 Response",
    "office_address": "Gohil sheri, Sankhewsar, Patan, Gujarat, India 384246",
    "office_note": "By Appointment",
    "live_chat_available": true,
    "live_chat_hours": "24/7 Support"
  }'::jsonb, NULL)
ON CONFLICT (key) DO NOTHING;