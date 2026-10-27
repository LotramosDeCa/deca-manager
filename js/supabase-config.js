// ============================================================
// DeCA Manager — Configuración de Supabase
// ============================================================

const SUPABASE_URL = 'https://dzotgifxgjfvpprjffow.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3RnaWZ4Z2pmdnBwcmpmZm93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzY3MTMsImV4cCI6MjEwODYxMjcxM30.seS6dgC3qcLxqxzBDksbgAusPXMioV60rhhG3f5ScFk';

let supabase;

// ------------------------------------------------------------
// Opciones del cliente
// ------------------------------------------------------------
// LOCK DESACTIVADO (causa raíz del bloqueo de la app):
// El SDK protege auth.getSession() con un lock guardado en el
// almacenamiento del navegador. Con Tracking Prevention activa,
// ese lock se coge pero nunca se libera, y TODAS las queries
// posteriores (decas, flota, equipo) esperan para siempre sin
// error ni timeout. Con un lock "no-op" cada llamada se ejecuta
// directamente y el bloqueo desaparece.
const SUPABASE_OPTIONS = {
  auth: {
    lock: async (name, acquireTimeout, fn) => await fn(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    // Red de seguridad: ninguna petición HTTP puede quedarse colgada
    fetch: (url, options = {}) => {
      const controller = new AbortController();
      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
      }
      const timer = setTimeout(() => controller.abort(), 15000);
      return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
    }
  }
};

// ------------------------------------------------------------
// sbSelect — lectura directa a la API REST, sin pasar por el SDK
// ------------------------------------------------------------
// El SDK se queda colgado en las lecturas tras varias navegaciones
// (la promesa nunca se resuelve: ni dato, ni error, ni timeout).
// Esta función hace la misma consulta con fetch y devuelve el mismo
// formato { data, error }, así que es un reemplazo directo.
let SB_TOKEN = null;

function sbToken() {
  if (SB_TOKEN) return SB_TOKEN;
  try {
    const raw = localStorage.getItem('sb-dzotgifxgjfvpprjffow-auth-token');
    if (raw) SB_TOKEN = JSON.parse(raw).access_token;
  } catch (e) { /* storage bloqueado */ }
  return SB_TOKEN || SUPABASE_ANON_KEY;
}

async function sbSelect(table, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + params, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + sbToken()
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { data: null, error: { message: (await res.text()) || ('HTTP ' + res.status) } };
    }
    return { data: await res.json(), error: null };
  } catch (e) {
    clearTimeout(timer);
    return { data: null, error: { message: e.name === 'AbortError' ? 'Tiempo de espera agotado' : e.message } };
  }
}

async function initSupabase() {
  if (typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_OPTIONS);
    return supabase;
  }

  // Si el SDK no está cargado aún, cargarlo dinámicamente
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js';
    script.onload = () => {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_OPTIONS);
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
