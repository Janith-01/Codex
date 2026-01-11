# Codex Editor - Database Setup Guide

## Prerequisites
- A Supabase account (free tier is fine)
- Access to Supabase Dashboard

## Step 1: Create a New Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in the details:
   - **Name**: Codex Editor (or your preferred name)
   - **Database Password**: Choose a strong password
   - **Region**: Select the closest region to you
4. Click "Create new project" and wait for it to initialize

## Step 2: Create the Documents Table

1. Once your project is ready, go to the **SQL Editor** (left sidebar)
2. Click "New Query"
3. Copy and paste the following SQL:

```sql
-- Create the documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for now
-- (In production, you'd want proper authentication)
CREATE POLICY "Allow all operations on documents" 
ON documents 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create an index on created_at for better query performance
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
```

4. Click "Run" to execute the query
5. You should see a success message

## Step 3: Get Your Supabase Credentials

1. Go to **Project Settings** (gear icon in the left sidebar)
2. Click on **API** in the left menu
3. You'll see:
   - **Project URL** (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key under "Project API keys"

## Step 4: Configure Environment Variables

1. Open the `.env` file in your project root
2. Replace the placeholder values with your actual credentials:

```
REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Save the file
4. **IMPORTANT**: Restart your development server after updating `.env`

```bash
# Stop the current server (Ctrl+C) and restart with:
npm start
```

## Step 5: Test the Connection

1. Go to [http://localhost:3000](http://localhost:3000)
2. Click "New Document"
3. If everything is configured correctly:
   - You should be redirected to `/document/{id}`
   - The Monaco Editor should load
   - You should be able to type and see auto-save indicators

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Make sure your `.env` file is in the project root (not in `src/`)
- Restart your development server after changing `.env`

### Error: "Document not found"
- Check if the `documents` table was created correctly
- Verify RLS policies are set up properly
- Check browser console for detailed error messages

### Error: "Failed to create document"
- Verify your Supabase credentials are correct
- Check if the RLS policy allows inserts
- Ensure you're connected to the internet

## Security Note

⚠️ **Important**: The current setup allows unrestricted access to all documents. This is fine for development and single-user scenarios, but for production, you should implement proper authentication and authorization.

For production use, consider:
- Implementing Supabase Auth
- Adding user_id column to link documents to users
- Updating RLS policies to ensure users can only access their own documents

## Next Steps

Once your database is set up and working:
1. Try creating multiple documents
2. Test the auto-save functionality (wait 1 second after typing)
3. Refresh the page to verify persistence
4. Try different programming languages and themes

Enjoy your persistent code editor! 🎉
