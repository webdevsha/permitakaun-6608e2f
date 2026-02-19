-- Check Organizers
SELECT id, organizer_code, name, status FROM organizers;

-- Check Active Locations linked to Organizers
SELECT l.id, l.name, l.status, l.organizer_id, o.organizer_code, o.name as organizer_name
FROM locations l
LEFT JOIN organizers o ON l.organizer_id = o.id
WHERE l.status = 'active';

-- Check Tenants and their linked Organizer Code
SELECT id, business_name, organizer_code FROM tenants;
