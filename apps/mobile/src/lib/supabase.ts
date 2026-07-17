import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://viwjknigxfxwszfvxsrg.supabase.co";
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_DLgZPAimcKU0CtM3-8O_OQ_vRHBPKv8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

export const API_URL = `${SUPABASE_URL}/functions/v1/api`;
