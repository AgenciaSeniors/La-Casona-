const CONFIG = {
    SUPABASE_URL: 'https://xwkmhpcombsauoozyidi.supabase.co',
    SUPABASE_KEY: 'sb_secret_eXR3y1whcxhZdJk41AnSXg_j5Wt8tIB',
    RESTAURANT_ID: 'ec2952c2-2cbe-44e8-afa4-3b7d16a5cf33',
    // Usamos el modelo más estable para evitar errores 404
    GEMINI_KEY: 'AIzaSyDDqPRUFilvcpVlFlMnxkYYju4RnVAFGv4' 
};

// Cliente Global de Supabase
//para obtener el SUPABASE_KEY voy a https://supabase.com/dashboard/project/mvtatdvpsjynvayhhksc/settings/api-keys?showConnect=true&connectTab=frameworks 
//entonce NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_XtV2kYHISXME2K-STuHmdw_UUGTZyvS
//SUPABASE_URL https://supabase.com/dashboard/project/mvtatdvpsjynvayhhksc/settings/api ====== Project URL
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);




