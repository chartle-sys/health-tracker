import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ROW_KEY = "default";

export async function loadRemoteState(): Promise<any | null> {
  const { data, error } = await supabase
    .from("healthlog_state")
    .select("state")
    .eq("id", ROW_KEY)
    .single();
  if (error || !data) return null;
  return data.state;
}

export async function saveRemoteState(state: any): Promise<void> {
  await supabase.from("healthlog_state").upsert({
    id: ROW_KEY,
    state,
    updated_at: new Date().toISOString(),
  });
}
