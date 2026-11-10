-- Add Google API configuration settings to app_settings table
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
  ('ga4_property_id', NULL, 'Google Analytics 4 Property ID (format: properties/XXXXXXXXX)'),
  ('google_drive_invoices_folder', NULL, 'Google Drive folder ID for storing invoices'),
  ('google_sheets_jobs_id', NULL, 'Google Sheets spreadsheet ID for jobs data'),
  ('google_sheets_analytics_id', NULL, 'Google Sheets spreadsheet ID for analytics data'),
  ('google_sheets_financial_id', NULL, 'Google Sheets spreadsheet ID for financial data')
ON CONFLICT (setting_key) DO NOTHING;