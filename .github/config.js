/* ============================================================
   A1+ Petty Cash Portal — Cloud database settings
   ------------------------------------------------------------
   Paste the two values from your Supabase project here.
   Find them in Supabase:  Project Settings  ->  API
     - Project URL   -> SUPABASE_URL
     - Project API keys -> "anon" / "public" key -> SUPABASE_ANON_KEY

   Until these are filled in, the app keeps using each browser's
   own local storage (the old behaviour).
   ============================================================ */
window.PCF_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-ref.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY"
};
