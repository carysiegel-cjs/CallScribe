// Public Supabase project details (safe to ship: they are sent to every browser anyway).
// Environment variables override them, e.g. for a staging project.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ujsqmjzwondjkkmpmdzd.supabase.co'
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqc3Ftanp3b25kamtrbXBtZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMTI0MzgsImV4cCI6MjEwODg4ODQzOH0.gWMN6i9T4cTpNeGNOfFxMn3MtdyxGyzRQyhK7olcNqE'
