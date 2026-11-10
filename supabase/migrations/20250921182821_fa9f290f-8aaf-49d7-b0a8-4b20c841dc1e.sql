-- Add most_popular field to all package tables
ALTER TABLE verification_packages ADD COLUMN most_popular boolean DEFAULT false;
ALTER TABLE boost_packages ADD COLUMN most_popular boolean DEFAULT false;
ALTER TABLE points_packages ADD COLUMN most_popular boolean DEFAULT false;

-- Set default most_popular packages (one per table)
UPDATE verification_packages SET most_popular = true WHERE id = (
  SELECT id FROM verification_packages WHERE name ILIKE '%gold%' ORDER BY created_at DESC LIMIT 1
);

UPDATE boost_packages SET most_popular = true WHERE id = (
  SELECT id FROM boost_packages WHERE boost_level >= 2 ORDER BY boost_level DESC LIMIT 1
);

UPDATE points_packages SET most_popular = true WHERE id = (
  SELECT id FROM points_packages WHERE points_amount >= 1000 ORDER BY points_amount ASC LIMIT 1
);

-- Create function to ensure only one most_popular per package type
CREATE OR REPLACE FUNCTION ensure_single_most_popular()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this package as most_popular
  IF NEW.most_popular = true THEN
    -- Remove most_popular from all other packages in the same table
    IF TG_TABLE_NAME = 'verification_packages' THEN
      UPDATE verification_packages SET most_popular = false WHERE id != NEW.id;
    ELSIF TG_TABLE_NAME = 'boost_packages' THEN
      UPDATE boost_packages SET most_popular = false WHERE id != NEW.id;
    ELSIF TG_TABLE_NAME = 'points_packages' THEN
      UPDATE points_packages SET most_popular = false WHERE id != NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all package tables
CREATE TRIGGER verification_packages_most_popular_trigger
  BEFORE UPDATE ON verification_packages
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_most_popular();

CREATE TRIGGER boost_packages_most_popular_trigger
  BEFORE UPDATE ON boost_packages
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_most_popular();

CREATE TRIGGER points_packages_most_popular_trigger
  BEFORE UPDATE ON points_packages
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_most_popular();