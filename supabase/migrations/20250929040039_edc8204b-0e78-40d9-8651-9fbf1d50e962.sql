-- Add admin role for vmgohil76@gmail.com user who is trying to access the admin panel

INSERT INTO public.admin_users (user_id, role) 
VALUES ('aeaee4a9-d898-4fe7-b4ff-02d66feb56e1', 'admin')
ON CONFLICT (user_id) DO UPDATE SET 
  role = 'admin',
  updated_at = now();