-- Add unique constraint to prevent duplicate reviews per user per company
ALTER TABLE company_reviews 
ADD CONSTRAINT unique_user_company_review 
UNIQUE (user_id, company_id);