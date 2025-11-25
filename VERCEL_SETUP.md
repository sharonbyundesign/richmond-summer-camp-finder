# Vercel Deployment Setup Guide

## Required Environment Variables

Add these environment variables in your Vercel project settings:

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Value: `https://smthfqpurmomutucutwt.supabase.co`
   - Enable for: Production, Preview, Development

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Value: `sb_publishable_FTP5-XFeZTr5pYK5lPxsWQ_XQ8tOHS3`
   - Enable for: Production, Preview, Development

## Steps to Add in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project: `richmond-summer-camp-finder`
3. Click **Settings** → **Environment Variables**
4. Add each variable above
5. Make sure to select all three environments (Production, Preview, Development)
6. Click **Save** for each variable
7. **Redeploy** your application

## Verify Setup

After redeploying, visit:
- Your app URL: `https://your-app.vercel.app`
- Test endpoint: `https://your-app.vercel.app/api/test-connection`

The test endpoint will show you if:
- ✅ Environment variables are set correctly
- ✅ Database connection works
- ✅ Tables are accessible

## Troubleshooting

If you still see "Server configuration error":
1. Double-check the variable names (they must match exactly)
2. Make sure you selected all three environments
3. Redeploy after adding variables
4. Check the Vercel deployment logs for any errors

