// config.js - Supabase Configuration
const SUPABASE_URL = 'https://cuasvqszzyddzlztxeng.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXN2cXN6enlkZHpsenR4ZW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNjUwOTIsImV4cCI6MjEwNjg0MTA5Mn0.PY3qOX8YnhTrd_uryneSRn9-Cv2qjAMso3t5Xl_gRys';

// Initialize Supabase Client if library is available
let supabase = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}