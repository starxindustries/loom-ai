# OAuth Integration Setup Guide

This guide explains how to set up OAuth integrations for the reminder system.

## 🔧 Environment Variables

Add these to your `.env.local` file:

```bash
# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Your app URL

# Google (Gmail & Google Calendar) - Integration OAuth App
GOOGLE_INTEGRATION_CLIENT_ID=your_google_integration_client_id
GOOGLE_INTEGRATION_SECRET=your_google_integration_secret

# Slack
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret

# Notion
NOTION_CLIENT_ID=your_notion_client_id
NOTION_CLIENT_SECRET=your_notion_client_secret
```

## 🚀 OAuth Provider Setup

### 1. Google (Gmail & Google Calendar)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable APIs:
   - Gmail API
   - Google Calendar API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Configure OAuth consent screen
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/oauth/callback` (development)
   - `https://yourdomain.com/api/auth/oauth/callback` (production)
7. Copy Client ID and Client Secret

**Required Scopes:**
- `https://www.googleapis.com/auth/gmail.send` (for sending emails)
- `https://www.googleapis.com/auth/calendar.events` (for calendar events)
- `https://www.googleapis.com/auth/userinfo.email` (for user identification)

### 2. Slack

1. Go to [Slack API](https://api.slack.com/apps)
2. Create a new app → "From scratch"
3. Go to "OAuth & Permissions"
4. Add redirect URLs:
   - `http://localhost:3000/api/auth/oauth/callback` (development)
   - `https://yourdomain.com/api/auth/oauth/callback` (production)
5. Add OAuth Scopes:
   - `chat:write` (send messages)
   - `channels:read` (read channel list)
   - `users:read` (read user info)
6. Copy Client ID and Client Secret from "Basic Information"

### 3. Notion

1. Go to [Notion Developers](https://developers.notion.com/)
2. Create a new integration
3. Configure OAuth:
   - Redirect URI: `http://localhost:3000/api/auth/oauth/callback`
   - Capabilities: Read content, Update content, Insert content
4. Copy OAuth client ID and client secret

## 📊 Database Schema

The OAuth URLs are stored in the `integration_providers` table:

```sql
-- Example data for Google
INSERT INTO integration_providers (
  name, slug, auth_type, 
  oauth_authorize_url, oauth_token_url, oauth_scopes,
  supported_actions, is_active
) VALUES (
  'Gmail', 'gmail', 'oauth2',
  'https://accounts.google.com/o/oauth2/v2/auth',
  'https://oauth2.googleapis.com/token',
  ARRAY['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email'],
  ARRAY['send_email'], true
);
```

## 🔄 OAuth Flow

1. **User clicks "Connect"** → Redirects to `/api/auth/oauth/[provider]`
2. **Generate auth URL** → Uses provider's `oauth_authorize_url` from database
3. **User authorizes** → Provider redirects to `/api/auth/oauth/callback`
4. **Exchange code for tokens** → Uses provider's `oauth_token_url`
5. **Store encrypted tokens** → Saved in `user_integrations` table
6. **Redirect to settings** → With success message

## 🔐 Security Features

- **State parameter** includes user ID and timestamp for CSRF protection
- **Token encryption** (implement with your crypto service)
- **Refresh token handling** for long-term access
- **Scope validation** ensures minimal required permissions

## 🧪 Testing

1. Start your development server
2. Go to `/protected/settings`
3. Click "Connect" on any OAuth provider
4. Complete the OAuth flow
5. Check the "Connected" tab to see your integration

## 🚨 Production Checklist

- [ ] Update redirect URIs to production domain
- [ ] Configure OAuth consent screens for production
- [ ] Implement proper token encryption
- [ ] Set up token refresh cron jobs
- [ ] Monitor OAuth error rates
- [ ] Configure rate limiting

## 🔧 Troubleshooting

### Common Issues:

1. **"redirect_uri_mismatch"**
   - Check OAuth app settings match your callback URL exactly

2. **"invalid_client"**
   - Verify client ID and secret are correct in environment variables

3. **"access_denied"**
   - User cancelled OAuth flow or app needs approval

4. **Token expired**
   - Implement refresh token logic in your automation tasks

### Debug Mode:

Add this to your environment for detailed OAuth logs:
```bash
DEBUG_OAUTH=true
```
