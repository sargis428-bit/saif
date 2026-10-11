// config.js - Supabase Configuration
const SUPABASE_URL = 'https://cuasvqszzyddzlztxeng.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NM0CfWZLb1vccsmkjmB9rQ_Z4WeSutF';

// Initialize Supabase Client
let supabaseClient = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}