// ============================================================
// DeCA Manager — Autenticación
// ============================================================

const Auth = {
  currentUser: null,
  currentProfile: null,

  // Inicializar auth y escuchar cambios de sesión
  async init() {
    await initSupabase();

    // Comprobar sesión existente
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await this.loadProfile(session.user, session.access_token);
    }

    // Escuchar cambios de estado de auth
    supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        // Actualizar token silenciosamente
        SB_TOKEN = session.access_token;
        App._authToken = session.access_token;
        // Solo cargar perfil y mostrar app si no estamos ya dentro
        const appVisible = document.getElementById('app-screen')?.classList.contains('active');
        if (!appVisible) {
          await this.loadProfile(session.user, session.access_token);
          App.showApp();
        }
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.currentProfile = null;
        App.showLogin();
      }
    });

    return !!session;
  },

  // Cargar perfil del usuario
  async loadProfile(user, accessToken) {
    this.currentUser = user;
    if (accessToken) SB_TOKEN = accessToken;

    const { data: filas, error } = await sbSelect('profiles', 'select=*&user_id=eq.' + user.id);
    const data = Array.isArray(filas) ? filas[0] : filas;

    if (error || !data) {
      console.error('Error cargando perfil:', error);
      await this.logout();
      return;
    }

    if (!data.activo) {
      showToast('Tu cuenta está desactivada. Contacta al administrador.', 'error');
      await this.logout();
      return;
    }

    this.currentProfile = data;
  },

  // Login con email y contraseña
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(this.translateError(error.message));
    }

    return data;
  },

  // Logout
  async logout() {
    // Avisar a Supabase, pero SIN esperar: signOut() puede quedarse
    // colgado y entonces no se cerraría nunca la sesión.
    try { supabase.auth.signOut(); } catch (e) { /* ignorar */ }

    // Borrar la sesión local directamente
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) { /* storage bloqueado */ }

    SB_TOKEN = null;
    App._authToken = null;
    this.currentProfile = null;
    App.showLogin();
  },

  // Es admin?
  isAdmin() {
    return this.currentProfile?.rol === 'admin';
  },

  // Nombre completo
  fullName() {
    if (!this.currentProfile) return '';
    return `${this.currentProfile.nombre} ${this.currentProfile.apellidos}`;
  },

  // Buscar email por nombre de usuario (RPC pública)
  async resolveUsername(username) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/get_email_by_username', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ p_username: username })
    });
    if (!res.ok) return null;
    const email = await res.json();
    return email || null;
  },

  // Enviar email de restablecer contraseña
  async forgotPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password.html'
    });
    if (error) throw new Error(this.translateError(error.message));
  },

  // Traducir errores de Supabase
  translateError(msg) {
    const map = {
      'Invalid login credentials': 'Credenciales incorrectas',
      'Email not confirmed': 'Email no confirmado',
      'Too many requests': 'Demasiados intentos. Espera un momento.',
      'User not found': 'Usuario no encontrado',
      'For security purposes, you can only request this once every 60 seconds': 'Solo puedes solicitar esto una vez por minuto',
    };
    return map[msg] || msg;
  }
};
