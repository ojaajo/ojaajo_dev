import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://ahessrcxqknznyplhnke.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QEUR0G9mbI0i6g3_F3gT_w_kEemLJQU";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);