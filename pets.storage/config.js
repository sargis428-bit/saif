// config.js - Supabase Configuration
// Replace with your actual Supabase Project URL and Anon Publishable Key
const SUPABASE_URL = 'https://your-supabase-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-publishable-anon-key-here';

// Initialize Supabase Client if library is available
let supabase = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}