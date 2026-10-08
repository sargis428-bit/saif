// config.js - Supabase Configuration
const SUPABASE_URL = 'https://cuasvqszzyddzlztxeng.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NM0CfWZLb1vccsmkjmB9rQ_Z4WeSutF';

// Initialize Supabase Client if library is available
let supabase = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}