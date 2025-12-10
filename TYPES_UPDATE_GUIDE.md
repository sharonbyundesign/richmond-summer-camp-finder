# Updating TypeScript Types After Database Changes

After making changes to your Supabase database, you need to update your TypeScript types to match the new schema.

## Option 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Scroll down to find the **"Generate TypeScript types"** section
4. Copy the generated types
5. Replace the contents of `src/types/database.ts` with the generated types
6. Make sure to keep the `Database` type export that your code uses

## Option 2: Using Supabase CLI

### First-time setup:
1. Install dependencies (includes Supabase CLI):
   ```bash
   npm install
   ```

2. Get your Supabase Project ID:
   - Go to your Supabase dashboard
   - Navigate to **Settings** → **General**
   - Copy your **Project ID** (or Reference ID)

3. Generate types:
   ```bash
   SUPABASE_PROJECT_ID=your-project-id npm run generate-types
   ```
   
   Or set it as an environment variable:
   ```bash
   export SUPABASE_PROJECT_ID=your-project-id
   npm run generate-types
   ```

### After database changes:
Just run the generate-types command again whenever you update your database schema.

## What to Check After Updating Types

1. **API Routes** (`src/app/api/camps/route.ts`):
   - Verify the query selects match your new schema
   - Check if any new fields need to be included

2. **Components** (`src/components/CampCard.tsx`):
   - Update if you added new fields that should be displayed

3. **Queries** (`src/lib/queries/*.ts`):
   - Check if any query functions need updates for new fields

4. **Type Errors**:
   - Run `npm run build` to check for TypeScript errors
   - Fix any type mismatches

## Quick Verification

After updating types, test your app:
```bash
npm run dev
```

Visit http://localhost:3000 and verify:
- Camps load correctly
- No console errors
- All fields display as expected

