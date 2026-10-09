import { supabase as client } from "../../../core/supabaseClient";
import { ServiceError } from "./errors";

export function getSupabase() {
  if (!client)
    throw new ServiceError(
      "Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env.",
    );
  return client;
}
