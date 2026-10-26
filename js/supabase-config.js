// ============================================================
// DeCA Manager — Configuración de Supabase
// ============================================================
// INSTRUCCIONES: Reemplaza estos valores con los de tu proyecto Supabase
// Dashboard → Settings → API

const SUPABASE_URL = 'https://dzotgifxgjfvpprjffow.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3RnaWZ4Z2pmdnBwcmpmZm93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzY3MTMsImV4cCI6MjEwODYxMjcxM30.seS6dgC3qcLxqxzBDksbgAusPXMioV60rhhG3f5ScFk';

// Inicializar cliente Supabase (se carga desde CDN en index.html)
// Usamos la versión del CDN que se carga como módulo UMD
let supabase;

async function initSupabase() {
  // Cargar Supabase JS SDK desde CDN
  if (typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
  }

  // Si no está cargado aún, cargarlo dinámicamente
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.min.js';
    script.onload = () => {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      resolve(supabase);
    };
    script.onerror = () => reject(new Error('No se pudo cargar Supabase SDK'));
    document.head.appendChild(script);
  });
}

// Helper: obtener el perfil del usuario actual
async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return profile;
}

// Helper: comprobar si el usuario actual es admin
async function checkIsAdmin() {
  const profile = await getCurrentProfile();
  return profile?.rol === 'admin';
}
