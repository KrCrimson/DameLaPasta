import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://tu-url-de-supabase.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'tu-llave-secreta';

// Utilizamos el service role key para poder leer y escribir desde el server
export const supabase = createClient(supabaseUrl, supabaseKey);
