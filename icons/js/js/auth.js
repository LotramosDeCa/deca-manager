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
      await this.loadProfile(session.user);
    }

    // Escuchar cambios de estado de auth
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await this.loadProfile(session.user);
        App.showApp();
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.currentProfile = null;
        App.showLogin();
      }
    });

    return !!session;
  },

  // Cargar perfil del usuario
  async loadProfile(user) {
    this.currentUser = user;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

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
    await supabase.auth.signOut();
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

  // Traducir errores de Supabase
  translateError(msg) {
    const map = {
      'Invalid login credentials': 'Credenciales incorrectas',
      'Email not confirmed': 'Email no confirmado',
      'Too many requests': 'Demasiados intentos. Espera un momento.',
      'User not found': 'Usuario no encontrado',
    };
    return map[msg] || msg;
  }
};
