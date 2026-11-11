const SUPABASE_URL = "https://rzodgpqzlzwvhqgfetgs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2IruzWKFWIjmC1l_ogivNA_U7iC8Mck";

window.wishlistSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);