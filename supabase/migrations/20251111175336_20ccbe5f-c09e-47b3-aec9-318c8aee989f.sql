-- Update existing jobs to parse location into city, state, country
UPDATE jobs
SET 
  country = TRIM(SPLIT_PART(location, ',', (length(location) - length(replace(location, ',', '')) + 1))),
  state = CASE 
    WHEN length(location) - length(replace(location, ',', '')) >= 2 
    THEN TRIM(SPLIT_PART(location, ',', 2))
    ELSE NULL
  END,
  city = CASE 
    WHEN length(location) - length(replace(location, ',', '')) >= 1 
    THEN TRIM(SPLIT_PART(location, ',', 1))
    ELSE NULL
  END
WHERE (city IS NULL OR state IS NULL OR country IS NULL) AND location IS NOT NULL;