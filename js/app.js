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

  async showApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    // Cachear token al iniciar para que el dashboard no dependa del SDK
    try {
      const s = await supabase.auth.getSession();
      this._authToken = s?.data?.session?.access_token || SUPABASE_ANON_KEY;
    } catch(e) { this._authToken = SUPABASE_ANON_KEY; }
    this.updateHeader();
    this.buildBottomNav();
    this._alertas = [];
    document.getElementById('bell-btn').addEventListener('click', () => this.showAlertasModal());
    this.loadAlertasBell(); // Cargar alertas en paralelo (no bloquea)
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
        { id: 'clientes', label: 'Clientes', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="8" y1="3" x2="8" y2="9"/></svg>' },
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

    // Botón volver: visible en todas las vistas excepto dashboard
    if (view === 'dashboard') {
      backBtn.hidden = true;
      backBtn.onclick = null;
    } else {
      backBtn.hidden = false;
      backBtn.onclick = () => this.navigate('dashboard');
    }

    // Limpiar contenido antes de cargar la nueva vista
    content.innerHTML = '<div style="display:flex; justify-content:center; padding:40px;"><div class="spinner" style="width:32px; height:32px; border:3px solid var(--border); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite;"></div></div>';

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
        case 'clientes':
          title.textContent = 'Clientes';
          await Clientes.render(content);
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

    const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    container.innerHTML = `
      <div class="greeting">
        <h3>${greeting} ${Auth.currentProfile.nombre}</h3>
        <p>${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</p>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--primary-soft); color:var(--primary);">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
          </div>
          <div class="stat-value" id="stat-activas">-</div>
          <div class="stat-label">DeCA activas</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#dcfce7; color:#16a34a;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
          </div>
          <div class="stat-value" id="stat-finalizadas">-</div>
          <div class="stat-label">Finalizadas</div>
        </div>
        ${isAdmin ? `
        <div class="stat-card">
          <div class="stat-icon" style="background:#fef3c7; color:#d97706;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <div class="stat-value" id="stat-conductores">-</div>
          <div class="stat-label">Conductores</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#fee2e2; color:#dc2626;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </div>
          <div class="stat-value" id="stat-vehiculos">-</div>
          <div class="stat-label">Vehículos</div>
        </div>
        ` : `
        <div class="stat-card">
          <div class="stat-icon" style="background:#fef3c7; color:#d97706;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="stat-value" id="stat-mes">-</div>
          <div class="stat-label">Este mes</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#fee2e2; color:#dc2626;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div class="stat-value" id="stat-modificadas">-</div>
          <div class="stat-label">Modificadas</div>
        </div>
        `}
      </div>
      ${isAdmin ? `
      <div id="dashboard-alertas-caducidad">
        <div class="skeleton" style="height:60px; margin-bottom:8px; border-radius:10px;"></div>
      </div>
      ` : ''}
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
    console.log('[DASH] Inicio loadDashboardStats');
    try {
      // Token cacheado para no depender del SDK (se bloquea en visitas sucesivas)
      if (!this._authToken) {
        try {
          const s = await supabase.auth.getSession();
          this._authToken = s?.data?.session?.access_token || SUPABASE_ANON_KEY;
        } catch(e) { this._authToken = SUPABASE_ANON_KEY; }
      }
      const token = this._authToken;
      const base = SUPABASE_URL + '/rest/v1';

      const dashFetch = async (url) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        try {
          const res = await fetch(base + url, {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': 'Bearer ' + token
            },
            signal: ctrl.signal
          });
          clearTimeout(timer);
          return await res.json();
        } catch (e) {
          clearTimeout(timer);
          console.warn('[DASH] fetch falló:', url, e.message);
          return null;
        }
      };

      if (isAdmin) {
        console.log('[DASH] Query decas...');
        const allDecas = await dashFetch('/decas?select=id,estado,created_at,referencia,origen,destino,fecha_transporte,matricula_vehiculo,nombre_conductor,version&order=created_at.desc') || [];
        console.log('[DASH] Decas recibidas:', allDecas.length);

        const activas = allDecas.filter(d => d.estado === 'activo').length;
        const finalizadas = allDecas.filter(d => d.estado === 'finalizado').length;
        const ultimas = allDecas.slice(0, 5);

        const profiles = await dashFetch('/profiles?select=id,nombre,apellidos,rol,fecha_cap,fecha_carnet&activo=eq.true') || [];
        const vehiculos = await dashFetch('/vehiculos?select=id,matricula,fecha_itv,fecha_seguro,fecha_tarjeta_transporte&activo=eq.true') || [];
        const remolques = await dashFetch('/remolques?select=id,matricula,fecha_itv,fecha_seguro&activo=eq.true') || [];

        const el = document.getElementById('stat-activas');
        if (!el) return;
        el.textContent = activas;
        document.getElementById('stat-finalizadas').textContent = finalizadas;
        document.getElementById('stat-conductores').textContent = profiles.length;
        document.getElementById('stat-vehiculos').textContent = vehiculos.length;
        this.renderUltimasDeCA(ultimas);
        this.renderAlertasCaducidad(vehiculos, remolques, profiles);

      } else {
        const pid = Auth.currentProfile.id;
        const now = new Date();
        const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

        const allDecas = await dashFetch('/decas?select=id,estado,fecha_transporte,created_at,referencia,origen,destino,matricula_vehiculo,nombre_conductor,version&conductor_id=eq.' + pid + '&order=created_at.desc') || [];

        const activas = allDecas.filter(d => d.estado === 'activo').length;
        const finalizadas = allDecas.filter(d => d.estado === 'finalizado').length;
        const mes = allDecas.filter(d => d.fecha_transporte && d.fecha_transporte >= firstOfMonth).length;
        const modificadas = allDecas.filter(d => d.estado === 'modificado').length;
        const ultimas = allDecas.slice(0, 5);

        const el = document.getElementById('stat-activas');
        if (!el) return;
        el.textContent = activas;
        document.getElementById('stat-finalizadas').textContent = finalizadas;
        document.getElementById('stat-mes').textContent = mes;
        document.getElementById('stat-modificadas').textContent = modificadas;
        this.renderUltimasDeCA(ultimas);
      }
      console.log('[DASH] Stats renderizadas OK');
    } catch (err) {
      console.warn('[DASH] Error cargando stats:', err);
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
      const dotColor = {
        activo: 'var(--primary)', finalizado: '#16a34a', modificado: '#d97706', anulado: '#dc2626',
      }[d.estado] || 'var(--primary)';
      const estadoLabel = {
        activo: 'Activa', finalizado: 'Finalizada', modificado: 'Modificada', anulado: 'Anulada',
      }[d.estado] || d.estado;
      const fecha = d.fecha_transporte
        ? new Date(d.fecha_transporte).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        : '—';

      return `
        <div class="deca-item" style="cursor:pointer;" onclick="App.navigate('decas')">
          <span class="deca-ref">${d.referencia || '—'}</span>
          <div class="deca-info">
            <strong>${d.origen || '?'} → ${d.destino || '?'}</strong>
            <span>${fecha} · ${d.nombre_conductor || ''}</span>
          </div>
          <span class="deca-status" style="color:${dotColor};" title="${estadoLabel}">●</span>
        </div>
      `;
    }).join('');
  },

  // ====== CAMPANITA DE ALERTAS ======
  async loadAlertasBell() {
    try {
      if (!this._authToken) {
        try {
          const s = await supabase.auth.getSession();
          this._authToken = s?.data?.session?.access_token || SUPABASE_ANON_KEY;
        } catch(e) { this._authToken = SUPABASE_ANON_KEY; }
      }
      const token = this._authToken;
      const base = SUPABASE_URL + '/rest/v1';
      const hdr = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token };
      const qFetch = async (url) => { try { const r = await fetch(base + url, { headers: hdr }); return await r.json(); } catch(e) { return []; } };

      const hoy = new Date(); hoy.setHours(0,0,0,0);
      const diasHasta = (f) => { if (!f) return null; return Math.ceil((new Date(f+'T00:00:00') - hoy) / 86400000); };
      const alertas = [];

      if (Auth.isAdmin()) {
        const vehiculos = await qFetch('/vehiculos?select=id,matricula,fecha_itv,fecha_seguro,fecha_tarjeta_transporte&activo=eq.true') || [];
        const remolques = await qFetch('/remolques?select=id,matricula,fecha_itv,fecha_seguro&activo=eq.true') || [];
        const profiles  = await qFetch('/profiles?select=id,nombre,apellidos,rol,fecha_cap,fecha_carnet&activo=eq.true') || [];

        (vehiculos).forEach(v => {
          [{campo:'fecha_itv',label:'ITV'},{campo:'fecha_seguro',label:'Seguro'},{campo:'fecha_tarjeta_transporte',label:'Tarjeta transp.'}].forEach(c => {
            const dias = diasHasta(v[c.campo]);
            if (dias !== null && dias <= 30) alertas.push({ tipo:'Vehículo', nombre:v.matricula, doc:c.label, dias, fecha:v[c.campo] });
          });
        });
        (remolques).forEach(r => {
          [{campo:'fecha_itv',label:'ITV'},{campo:'fecha_seguro',label:'Seguro'}].forEach(c => {
            const dias = diasHasta(r[c.campo]);
            if (dias !== null && dias <= 30) alertas.push({ tipo:'Remolque', nombre:r.matricula, doc:c.label, dias, fecha:r[c.campo] });
          });
        });
        (profiles).filter(p => p.rol === 'conductor').forEach(p => {
          [{campo:'fecha_cap',label:'CAP'},{campo:'fecha_carnet',label:'Carnet'}].forEach(c => {
            const dias = diasHasta(p[c.campo]);
            if (dias !== null && dias <= 30) alertas.push({ tipo:'Conductor', nombre:`${p.nombre} ${p.apellidos}`, doc:c.label, dias, fecha:p[c.campo] });
          });
        });
      } else {
        // Conductor: solo sus propias alertas
        const p = Auth.currentProfile;
        [{campo:'fecha_cap',label:'CAP'},{campo:'fecha_carnet',label:'Carnet de conducir'}].forEach(c => {
          const dias = diasHasta(p[c.campo]);
          if (dias !== null && dias <= 30) alertas.push({ tipo:'Tu documento', nombre:`${p.nombre} ${p.apellidos}`, doc:c.label, dias, fecha:p[c.campo] });
        });
      }

      alertas.sort((a, b) => a.dias - b.dias);
      this._alertas = alertas;
      this.updateBellBadge();
    } catch(e) {
      console.warn('[BELL] Error cargando alertas:', e);
    }
  },

  updateBellBadge() {
    const badge = document.getElementById('bell-count');
    if (!badge) return;
    const count = this._alertas.length;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  },

  showAlertasModal() {
    const alertas = this._alertas || [];
    const alertColor = (d) => d <= 7 ? '#dc2626' : '#d97706';
    const alertBg    = (d) => d <= 7 ? '#fee2e2' : '#fef3c7';

    if (alertas.length === 0) {
      showModal('🔔 Alertas', `
        <div class="empty-state" style="padding:24px 0;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--fg-muted);">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <p style="margin-top:8px; color:var(--fg-secondary);">Todo en orden, sin caducidades próximas</p>
        </div>
      `, '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>');
      return;
    }

    const listHTML = alertas.map(a => {
      const color = alertColor(a.dias);
      const bg    = alertBg(a.dias);
      const label = a.dias < 0 ? 'CADUCADO' : a.dias === 0 ? 'HOY' : `${a.dias}d`;
      const fecha = new Date(a.fecha + 'T00:00:00').toLocaleDateString('es-ES');
      return `
        <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--bg-card); border-radius:10px; border:1px solid var(--border-light); margin-bottom:6px;">
          <span style="background:${bg}; color:${color}; font-weight:700; font-size:11px; padding:3px 8px; border-radius:6px; white-space:nowrap;">${label}</span>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; font-size:14px; color:var(--fg);">${a.nombre}</div>
            <div style="font-size:12px; color:var(--fg-secondary);">${a.tipo} · ${a.doc} · ${fecha}</div>
          </div>
        </div>
      `;
    }).join('');

    showModal('🔔 Alertas de caducidad', `
      <div style="max-height:60vh; overflow-y:auto;">${listHTML}</div>
    `, '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>');
  },

  // ====== ALERTAS DE CADUCIDAD (Dashboard admin) ======
  renderAlertasCaducidad(vehiculos, remolques, profiles) {
    const container = document.getElementById('dashboard-alertas-caducidad');
    if (!container) return;

    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const diasHasta = (f) => { if (!f) return null; return Math.ceil((new Date(f+'T00:00:00') - hoy) / 86400000); };
    const alertas = [];

    // Vehículos
    (vehiculos || []).forEach(v => {
      [{ campo: 'fecha_itv', label: 'ITV' }, { campo: 'fecha_seguro', label: 'Seguro' }, { campo: 'fecha_tarjeta_transporte', label: 'Tarjeta transp.' }].forEach(c => {
        const dias = diasHasta(v[c.campo]);
        if (dias !== null && dias <= 30) {
          alertas.push({ tipo: 'Vehículo', nombre: v.matricula, doc: c.label, dias, fecha: v[c.campo] });
        }
      });
    });

    // Remolques
    (remolques || []).forEach(r => {
      [{ campo: 'fecha_itv', label: 'ITV' }, { campo: 'fecha_seguro', label: 'Seguro' }].forEach(c => {
        const dias = diasHasta(r[c.campo]);
        if (dias !== null && dias <= 30) {
          alertas.push({ tipo: 'Remolque', nombre: r.matricula, doc: c.label, dias, fecha: r[c.campo] });
        }
      });
    });

    // Conductores
    (profiles || []).filter(p => p.rol === 'conductor').forEach(p => {
      [{ campo: 'fecha_cap', label: 'CAP' }, { campo: 'fecha_carnet', label: 'Carnet' }].forEach(c => {
        const dias = diasHasta(p[c.campo]);
        if (dias !== null && dias <= 30) {
          alertas.push({ tipo: 'Conductor', nombre: `${p.nombre} ${p.apellidos}`, doc: c.label, dias, fecha: p[c.campo] });
        }
      });
    });

    // Ordenar: los más urgentes primero
    alertas.sort((a, b) => a.dias - b.dias);

    if (alertas.length === 0) {
      container.innerHTML = '';
      return;
    }

    const alertColor = (d) => d <= 7 ? '#dc2626' : '#d97706';
    const alertBg    = (d) => d <= 7 ? '#fee2e2' : '#fef3c7';

    container.innerHTML = `
      <div class="section-header" style="margin-top:4px;">
        <h3>⚠️ Próximas caducidades</h3>
      </div>
      ${alertas.slice(0, 8).map(a => {
        const color = alertColor(a.dias);
        const bg    = alertBg(a.dias);
        const label = a.dias < 0 ? 'CADUCADO' : a.dias === 0 ? 'HOY' : `${a.dias}d`;
        const fecha = new Date(a.fecha + 'T00:00:00').toLocaleDateString('es-ES');
        return `
          <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--bg-card); border-radius:10px; border:1px solid var(--border-light); margin-bottom:6px;">
            <span class="alert-pill" style="background:${bg}; color:${color}; font-weight:700; font-size:11px; padding:3px 8px; border-radius:6px; white-space:nowrap;">${label}</span>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600; font-size:14px; color:var(--fg);">${a.nombre}</div>
              <div style="font-size:12px; color:var(--fg-secondary);">${a.tipo} · ${a.doc} · ${fecha}</div>
            </div>
          </div>
        `;
      }).join('')}
      ${alertas.length > 8 ? `<p style="text-align:center; font-size:12px; color:var(--fg-muted); margin-top:4px;">+${alertas.length - 8} alertas más en Flota y Equipo</p>` : ''}
    `;
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
