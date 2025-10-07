-- Update Gmail OAuth scopes to include user info access
-- This will allow fetching user email and profile information during OAuth

UPDATE integration_providers 
SET 
  oauth_scopes = ARRAY[
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ],
  updated_at = now()
WHERE slug = 'gmail';

-- Update Google Calendar OAuth scopes to include user info access
UPDATE integration_providers 
SET 
  oauth_scopes = ARRAY[
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ],
  updated_at = now()
WHERE slug = 'google_calendar';

-- Verify the updates
SELECT name, slug, oauth_scopes 
FROM integration_providers 
WHERE slug IN ('gmail', 'google_calendar');
