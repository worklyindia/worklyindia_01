
-- Update Google API configuration settings
UPDATE app_settings SET setting_value = 'properties/325157898', updated_at = NOW() 
WHERE setting_key = 'ga4_property_id';

UPDATE app_settings SET setting_value = '1-0a-w_iD8IWCcTXjYkETZwgefM63Ja1F', updated_at = NOW() 
WHERE setting_key = 'google_drive_invoices_folder';

UPDATE app_settings SET setting_value = '1_d35hPTE9TdST6vVr3avgLumYE8d3Q_8vSIBpmyPX0Y', updated_at = NOW() 
WHERE setting_key = 'google_sheets_jobs_id';

UPDATE app_settings SET setting_value = '1_d35hPTE9TdST6vVr3avgLumYE8d3Q_8vSIBpmyPX0Y', updated_at = NOW() 
WHERE setting_key = 'google_sheets_analytics_id';

UPDATE app_settings SET setting_value = '1_d35hPTE9TdST6vVr3avgLumYE8d3Q_8vSIBpmyPX0Y', updated_at = NOW() 
WHERE setting_key = 'google_sheets_financial_id';
