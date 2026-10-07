import { createBrowserClient } from "@supabase/ssr";
import project from "./project.json";

// This file contains only the public browser connection, protected by database RLS.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || project.url;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || project.publishableKey;

export function isSupabaseConfigured() {
  return Boolean(url && publishableKey);
}

export function createClient() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(url, publishableKey);
}
