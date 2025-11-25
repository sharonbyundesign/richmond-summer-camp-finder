# Richmond Summer Camp Finder

A Next.js application for finding summer camps in Richmond, built with TypeScript and Supabase.

## Features

- Next.js 14 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Supabase integration for database queries
- Query utilities for:
  - `camps` table
  - `camp_sessions` table
  - `camp_interests` table

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up your Supabase credentials:
   - Copy `.env.local.example` to `.env.local` (already created)
   - Add your Supabase project URL and anon key:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. Update TypeScript types:
   - Edit `src/types/database.ts` to match your actual Supabase table schemas

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
richmond-summer-camp-finder/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── lib/
│   │   ├── supabase.ts   # Supabase client configuration
│   │   └── queries/      # Query utilities
│   │       ├── camps.ts
│   │       ├── camp-sessions.ts
│   │       └── camp-interests.ts
│   └── types/
│       └── database.ts   # TypeScript type definitions
├── .env.local            # Environment variables (gitignored)
├── .env.local.example    # Example environment variables
└── package.json
```

## Available Query Functions

### Camps
- `getAllCamps()` - Fetch all camps
- `getCampById(id)` - Fetch a single camp by ID
- `searchCamps(query)` - Search camps by name or description

### Camp Sessions
- `getAllCampSessions()` - Fetch all camp sessions
- `getCampSessionById(id)` - Fetch a single session by ID
- `getSessionsByCampId(campId)` - Fetch all sessions for a camp
- `getSessionsByDateRange(startDate, endDate)` - Fetch sessions in a date range

### Camp Interests
- `getAllCampInterests()` - Fetch all camp interests
- `getCampInterestById(id)` - Fetch a single interest by ID
- `getInterestsByCampId(campId)` - Fetch all interests for a camp

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)


