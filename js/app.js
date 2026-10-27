// ============================================================
// DeCA Manager — Controlador principal de la app
// ============================================================

const App = {
  currentView: 'dashboard',

  // Inicializar app
  async start() {
    this.bindLoginForm();
    this.bindMenuToggle();

    const hasSession = await Auth.init();
    if (hasSession) {
      this.showApp();
    } else {
      this.showLogin();
    }
  },

  // ====== PANTALLAS ======
  showLogin() {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').hidden = true;
  },

  showApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    this.updateHeader();
    this.buildBottomNav();
    this.navigate('dashboard');
  },

  // ====== HEADER ======
  updateHeader() {
    const badge = document.getElementById('user-badge');
    const menuName = document.getElementById('menu-user-name');
    const menuRole = document.getElementById('menu-user-role');

    if (Auth.isAdmin()) {
      badge.textContent = 'Admin';
      badge.className = 'badge badge-admin';
    } else {
      badge.textContent = 'Conductor';
      badge.className = 'badge badge-conductor';
    }

    menuName.textContent = Auth.fullName();
    menuRole.textContent = Auth.currentProfile.rol;
    menuRole.className = `badge badge-small badge-${Auth.currentProfile.rol}`;
  },

  // ====== NAVEGACIÓN ======
  buildBottomNav() {
    const nav = document.getElementById('bottom-nav');
    const isAdmin = Auth.isAdmin();

    const items = [
      { id: 'dashboard', label: 'Inicio', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>' },
      { id: 'decas', label: 'DeCA', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
    ];

    if (isAdmin) {
      items.push(
        { id: 'vehiculos', label: 'Flota', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' },
        { id: 'usuarios', label: 'Equipo', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' }
      );
    }

    nav.innerHTML = items.map(item => `
      <button class="nav-item ${item.id === this.currentView ? 'active' : ''}" data-view="${item.id}">
        ${item.icon}
        <span>${item.label}</span>
      </button>
    `).join('');

    nav.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.view));
    });
  },

  _navId: 0, // Protección contra navegaciones simultáneas

  async navigate(view) {
    const navId = ++this._navId;
    console.log('[NAV] →', view, 'navId:', navId);
    this.currentView = view;
    const content = document.getElementById('main-content');
    const title = document.getElementById('header-title');
    const backBtn = document.getElementById('back-btn');

    // Cerrar cualquier modal abierto (evita bloqueos)
    closeModal();

    // Actualizar nav activa
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Resetear botón volver
    backBtn.hidden = true;
    backBtn.onclick = null;

    // Limpiar contenido antes de cargar la nueva vista
    content.innerHTML = '<div style="display:flex; justify-content:center; padding:40px;"><div class="spinner" style="width:32px; height:32px; border:3px solid #e5e7eb; border-top-color:#1a56db; border-radius:50%; animation:spin 0.8s linear infinite;"></div></div>';

    try {
      switch (view) {
        case 'dashboard':
          title.textContent = 'Dashboard';
          await this.renderDashboard(content);
          break;
        case 'decas':
          title.textContent = Auth.isAdmin() ? 'DeCA' : 'Mis DeCA';
          await Decas.render(content);
          break;
        case 'vehiculos':
          title.textContent = 'Flota';
          await Flota.render(content);
          break;
        case 'usuarios':
          title.textContent = 'Equipo';
          await Usuarios.render(content);
          break;
        default:
          title.textContent = 'Dashboard';
          await this.renderDashboard(content);
      }
    } catch (err) {
      if (navId !== this._navId) return;
      console.error('Error navegando a', view, err);
      content.innerHTML = `
        <div class="empty-state">
          <p style="color:var(--danger);">Error al cargar la vista</p>
          <p style="font-size:12px; color:var(--gray-400); margin-top:4px;">${err.message || ''}</p>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('${view}')" style="margin-top:12px;">Reintentar</button>
        </div>
      `;
    }

    // Si otra navegación empezó mientras esta cargaba, no tocar nada
    if (navId !== this._navId) return;
  },

  // Navegar a sub-vista con botón volver
  navigateDetail(title, renderFn) {
    const content = document.getElementById('main-content');
    const headerTitle = document.getElementById('header-title');
    const backBtn = document.getElementById('back-btn');
    const prevView = this.currentView;

    headerTitle.textContent = title;
    backBtn.hidden = false;
    backBtn.onclick = () => this.navigate(prevView);

    renderFn(content);
  },

  // ====== DASHBOARD ======
  async renderDashboard(container) {
    const isAdmin = Auth.isAdmin();
    const greeting = this.getGreeting();

    container.innerHTML = `
      <div style="margin-bottom: 20px;">
        <p style="font-size: 14px; color: var(--gray-500);">${greeting}</p>
        <h3 style="font-size: 22px; font-weight: 700; color: var(--gray-900); margin-top: 2px;">
          ${Auth.currentProfile.nombre}
        </h3>
      </div>
      <div class="stats-grid">
        <div class="stat-card stat-primary">
          <div class="stat-value" id="stat-activas">-</div>
          <div class="stat-label">DeCA activas</div>
        </div>
        <div class="stat-card stat-success">
          <div class="stat-value" id="stat-finalizadas">-</div>
          <div class="stat-label">Finalizadas</div>
        </div>
        ${isAdmin ? `
        <div class="stat-card stat-warning">
          <div class="stat-value" id="stat-conductores">-</div>
          <div class="stat-label">Conductores</div>
        </div>
        <div class="stat-card stat-danger">
          <div class="stat-value" id="stat-vehiculos">-</div>
          <div class="stat-label">Vehículos</div>
        </div>
        ` : `
        <div class="stat-card stat-warning">
          <div class="stat-value" id="stat-mes">-</div>
          <div class="stat-label">Este mes</div>
        </div>
        <div class="stat-card stat-danger">
          <div class="stat-value" id="stat-modificadas">-</div>
          <div class="stat-label">Modificadas</div>
        </div>
        `}
      </div>
      <div class="section-header">
        <h3>Últimas DeCA</h3>
      </div>
      <div id="dashboard-ultimas-deca">
        <div class="skeleton" style="height:60px; margin-bottom:8px; border-radius:10px;"></div>
        <div class="skeleton" style="height:60px; margin-bottom:8px; border-radius:10px;"></div>
      </div>
    `;

    // Cargar stats reales (con await para que navigate espere)
    await this.loadDashboardStats(isAdmin);
  },

  async loadDashboardStats(isAdmin) {
    try {
      if (isAdmin) {
        // Stats admin: DeCA activas, finalizadas, conductores (todos los perfiles activos), vehículos
        const [activas, finalizadas, conductores, vehiculos, ultimas] = await Promise.all([
          supabase.from('decas').select('id', { count: 'exact', head: true }).eq('estado', 'activo'),
          supabase.from('decas').select('id', { count: 'exact', head: true }).eq('estado', 'finalizado'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('activo', true),
          supabase.from('vehiculos').select('id', { count: 'exact', head: true }).eq('activo', true),
          supabase.from('decas').select('*').order('created_at', { ascending: false }).limit(5),
        ]);

        const elActivas = document.getElementById('stat-activas');
        if (!elActivas) return; // Vista ya cambió
        elActivas.textContent = activas.count || 0;
        document.getElementById('stat-finalizadas').textContent = finalizadas.count || 0;
        document.getElementById('stat-conductores').textContent = conductores.count || 0;
        document.getElementById('stat-vehiculos').textContent = vehiculos.count || 0;
        this.renderUltimasDeCA(ultimas.data || []);
      } else {
        // Stats conductor
        const pid = Auth.currentProfile.id;
        const now = new Date();
        const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

        const [activas, finalizadas, mes, modificadas, ultimas] = await Promise.all([
          supabase.from('decas').select('id', { count: 'exact', head: true }).eq('conductor_id', pid).eq('estado', 'activo'),
          supabase.from('decas').select('id', { count: 'exact', head: true }).eq('conductor_id', pid).eq('estado', 'finalizado'),
          supabase.from('decas').select('id', { count: 'exact', head: true }).eq('conductor_id', pid).gte('fecha_transporte', firstOfMonth),
          supabase.from('decas').select('id', { count: 'exact', head: true }).eq('conductor_id', pid).eq('estado', 'modificado'),
          supabase.from('decas').select('*').eq('conductor_id', pid).order('created_at', { ascending: false }).limit(5),
        ]);

        const elActivas2 = document.getElementById('stat-activas');
        if (!elActivas2) return; // Vista ya cambió
        elActivas2.textContent = activas.count || 0;
        document.getElementById('stat-finalizadas').textContent = finalizadas.count || 0;
        document.getElementById('stat-mes').textContent = mes.count || 0;
        document.getElementById('stat-modificadas').textContent = modificadas.count || 0;
        this.renderUltimasDeCA(ultimas.data || []);
      }
    } catch (err) {
      console.warn('Error cargando stats:', err);
    }
  },

  renderUltimasDeCA(decas) {
    const container = document.getElementById('dashboard-ultimas-deca');
    if (!container) return;

    if (decas.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <p>Aún no hay DeCA creadas</p>
        </div>
      `;
      return;
    }

    container.innerHTML = decas.map(d => {
      const estadoClass = {
        activo: 'badge-info', finalizado: 'badge-success', modificado: 'badge-warning', anulado: 'badge-danger',
      }[d.estado] || 'badge-info';
      const estadoLabel = {
        activo: 'Activa', finalizado: 'Finalizada', modificado: 'Modificada', anulado: 'Anulada',
      }[d.estado] || d.estado;
      const fecha = d.fecha_transporte
        ? new Date(d.fecha_transporte).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        : '—';

      return `
        <div class="list-card" style="cursor:pointer;" onclick="App.navigate('decas')">
          <div class="list-card-icon" style="background:var(--primary-50); color:var(--primary);">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
          </div>
          <div class="list-card-info">
            <div class="name">${d.referencia || '—'}</div>
            <div class="detail">${d.origen || '?'} → ${d.destino || '?'} · ${fecha}</div>
          </div>
          <span class="badge ${estadoClass}" style="font-size:10px;">${estadoLabel}</span>
        </div>
      `;
    }).join('');
  },

  getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días,';
    if (h < 20) return 'Buenas tardes,';
    return 'Buenas noches,';
  },

  // ====== PLACEHOLDERS (se construyen en chunks posteriores) ======
  renderDecasPlaceholder(container) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
        </svg>
        <p>Gestión de DeCA</p>
        <p style="font-size:12px; margin-top:8px; color: var(--gray-400);">Se habilitará en el chunk 3</p>
      </div>
    `;
  },

  renderVehiculosPlaceholder(container) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="3" width="15" height="13"/>
          <polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
        <p>Gestión de flota</p>
        <p style="font-size:12px; margin-top:8px; color: var(--gray-400);">Se habilitará en el chunk 2</p>
      </div>
    `;
  },

  // ====== LOGIN FORM ======
  bindLoginForm() {
    const form = document.getElementById('login-form');
    const btn = document.getElementById('login-btn');
    const error = document.getElementById('login-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      error.hidden = true;
      btn.disabled = true;
      btn.querySelector('.btn-text').textContent = 'Entrando...';
      btn.querySelector('.btn-spinner').hidden = false;

      try {
        await Auth.login(email, password);
        // onAuthStateChange se encarga del resto
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Iniciar sesión';
        btn.querySelector('.btn-spinner').hidden = true;
      }
    });

    // Toggle password visibility
    document.querySelector('.toggle-password')?.addEventListener('click', function() {
      const input = document.getElementById('login-password');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      this.innerHTML = isPassword
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    });
  },

  // ====== MENÚ ======
  bindMenuToggle() {
    const menuBtn = document.getElementById('menu-btn');
    const menu = document.getElementById('dropdown-menu');

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });

    document.addEventListener('click', () => {
      menu.hidden = true;
    });

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('[data-action]');
      if (!item) return;
      menu.hidden = true;

      switch (item.dataset.action) {
        case 'logout':
          Auth.logout();
          break;
      }
    });
  }
};

// ====== UTILIDADES GLOBALES ======
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.hidden = true; }, 3000);
}

function showModal(title, bodyHTML, footerHTML = '') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-footer').innerHTML = footerHTML;
  document.getElementById('modal-overlay').hidden = false;
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
  // También cerrar el overlay QR a pantalla completa si existe
  const qrOverlay = document.getElementById('qr-fullscreen');
  if (qrOverlay) qrOverlay.remove();
}

// Cerrar modal con click en overlay o botón X
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});
document.querySelector('.modal-close')?.addEventListener('click', closeModal);

// Confirmar acción con modal
function confirmAction(message, onConfirm) {
  showModal('Confirmar', `<p class="confirm-text">${message}</p>`, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" id="confirm-action-btn">Confirmar</button>
  `);
  document.getElementById('confirm-action-btn').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}

// Iniciar app cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => App.start());
