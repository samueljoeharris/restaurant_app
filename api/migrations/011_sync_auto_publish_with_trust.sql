-- Align auto_publish with trust tier (trusted = immediate publish; all others = queued).
UPDATE user_profiles
SET auto_publish = (trust_level = 'trusted')
WHERE auto_publish IS DISTINCT FROM (trust_level = 'trusted');
