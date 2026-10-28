-- Fix existing interviews with wrong HMS room ID
UPDATE interviews 
SET hms_room_id = 'cPN2-mbBV-hjcG-QvrZ',
    hms_host_prebuilt_url = NULL,
    hms_participant_prebuilt_urls = NULL
WHERE mode = '100ms' 
AND hms_room_id = '68f104cc033903926e6255f2';