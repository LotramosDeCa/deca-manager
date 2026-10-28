// ============================================================
// DeCA Manager — Gestión de Clientes (Cargadores / Destinatarios)
// Solo Admin
// ============================================================

const Clientes = {
  list: [],
  searchQuery: '',

  // ====== RENDERIZAR VISTA PRINCIPAL ======
  async render(container) {
    if (!Auth.isAdmin()) {
      container.innerHTML = '<div class="empty-state"><p>No tienes acceso a esta sección</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="section-header">
        <div class="search-inline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="clientes-search" placeholder="Buscar nombre, NIF..." style="border:none; outline:none; font-size:14px; background:transparent; flex:1;">
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-cliente">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo
        </button>
      </div>
      <div id="clientes-list" class="card-list">
        <div class="skeleton" style="height: 72px; margin-bottom: 8px;"></div>
        <div class="skeleton" style="height: 72px; margin-bottom: 8px;"></div>
        <div class="skeleton" style="height: 72px;"></div>
      </div>
    `;

    // Bind search
    document.getElementById('clientes-search').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.renderList();
    });

    // Bind add button
    document.getElementById('btn-add-cliente').addEventListener('click', () => this.showForm());

    // Load data
    await this.loadClientes();
  },

  // ====== CARGAR DATOS ======
  async loadClientes() {
    const { data, error } = await sbSelect('clientes', 'select=*&order=nombre.asc');

    if (error) {
      showToast('Error cargando clientes', 'error');
      console.error(error);
      return;
    }
    this.list = data || [];
    this.renderList();
  },

  // ====== RENDERIZAR LISTA ======
  renderList() {
    const container = document.getElementById('clientes-list');
    if (!container) return;

    // Filtrar por búsqueda
    const filtered = this.searchQuery
      ? this.list.filter(c =>
          c.nombre.toLowerCase().includes(this.searchQuery) ||
          (c.nif || '').toLowerCase().includes(this.searchQuery) ||
          (c.poblacion || '').toLowerCase().includes(this.searchQuery)
        )
      : this.list;

    if (filtered.length === 0) {
      const emptyMsg = this.searchQuery
        ? 'No se encontraron resultados'
        : 'No hay clientes registrados';

      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <p>${emptyMsg}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(c => {
      const icon = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--primary)" stroke-width="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="8" y1="3" x2="8" y2="9"/></svg>';

      return `
        <div class="list-card" data-id="${c.id}">
          <div class="list-card-icon">${icon}</div>
          <div class="list-card-info">
            <div class="name">${c.nombre}</div>
            <div class="detail">${c.nif || 'Sin NIF'}${c.poblacion ? ' · ' + c.poblacion : ''}</div>
          </div>
          <span class="badge badge-${c.activo ? 'activo' : 'inactivo'}">${c.activo ? 'Activo' : 'Inactivo'}</span>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.list-card').forEach(card => {
      card.addEventListener('click', () => {
        const c = this.list.find(x => x.id === card.dataset.id);
        if (c) this.showDetail(c);
      });
    });
  },

  // ====== DETALLE ======
  showDetail(c) {
    const statusBadge = c.activo
      ? '<span class="badge badge-activo">Activo</span>'
      : '<span class="badge badge-inactivo">Inactivo</span>';

    showModal(c.nombre, `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="list-card-icon" style="width:56px;height:56px;font-size:24px;">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--primary)" stroke-width="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="8" y1="3" x2="8" y2="9"/></svg>
          </div>
          <div>${statusBadge}</div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div>
            <span style="font-size:12px; color:var(--gray-500);">Nombre</span>
            <p style="font-size:14px; font-weight:600;">${c.nombre}</p>
          </div>
          <div>
            <span style="font-size:12px; color:var(--gray-500);">NIF</span>
            <p style="font-size:14px; font-weight:500;">${c.nif || '—'}</p>
          </div>
          <div style="grid-column:1/-1;">
            <span style="font-size:12px; color:var(--gray-500);">Dirección</span>
            <p style="font-size:14px; font-weight:500;">${c.direccion || '—'}</p>
          </div>
          <div>
            <span style="font-size:12px; color:var(--gray-500);">Población</span>
            <p style="font-size:14px; font-weight:500;">${c.poblacion || '—'}</p>
          </div>
          <div>
            <span style="font-size:12px; color:var(--gray-500);">C.P.</span>
            <p style="font-size:14px; font-weight:500;">${c.codigo_postal || '—'}</p>
          </div>
          <div>
            <span style="font-size:12px; color:var(--gray-500);">Provincia</span>
            <p style="font-size:14px; font-weight:500;">${c.provincia || '—'}</p>
          </div>
          <div>
            <span style="font-size:12px; color:var(--gray-500);">Registrado</span>
            <p style="font-size:14px; font-weight:500;">${new Date(c.created_at).toLocaleDateString('es-ES')}</p>
          </div>
        </div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
      <button class="btn btn-primary" onclick="Clientes.showForm('${c.id}')">Editar</button>
      <button class="btn ${c.activo ? 'btn-danger' : 'btn-success'} btn-sm" onclick="Clientes.toggleActive('${c.id}', ${!c.activo})">${c.activo ? 'Desactivar' : 'Activar'}</button>
    `);
  },

  // ====== FORMULARIO CREAR/EDITAR ======
  showForm(clienteId) {
    closeModal();
    const item = clienteId ? this.list.find(c => c.id === clienteId) : null;
    const isEdit = !!item;
    const title = isEdit ? 'Editar cliente' : 'Nuevo cliente';

    const formHTML = `
      <form id="cliente-form" style="display:flex; flex-direction:column; gap:4px;">
        <div class="form-group">
          <label for="cliente-nombre">Nombre / Razón social *</label>
          <input type="text" id="cliente-nombre" required value="${item?.nombre || ''}" placeholder="Ej: Transportes García S.L.">
        </div>
        <div class="form-group">
          <label for="cliente-nif">NIF / CIF</label>
          <input type="text" id="cliente-nif" value="${item?.nif || ''}" placeholder="Ej: B12345678" style="text-transform:uppercase;">
        </div>
        <div class="form-group">
          <label for="cliente-direccion">Dirección</label>
          <input type="text" id="cliente-direccion" value="${item?.direccion || ''}" placeholder="Ej: C/ Mayor, 10">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="cliente-poblacion">Población</label>
            <input type="text" id="cliente-poblacion" value="${item?.poblacion || ''}" placeholder="Ej: Madrid">
          </div>
          <div class="form-group">
            <label for="cliente-cp">C. Postal</label>
            <input type="text" id="cliente-cp" value="${item?.codigo_postal || ''}" placeholder="28001" maxlength="5">
          </div>
        </div>
        <div class="form-group">
          <label for="cliente-provincia">Provincia</label>
          <input type="text" id="cliente-provincia" value="${item?.provincia || ''}" placeholder="Ej: Madrid">
        </div>
        <div id="cliente-form-error" class="error-msg" hidden></div>
      </form>
    `;

    showModal(title, formHTML, `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="cliente-form-submit">
        <span class="btn-text">${isEdit ? 'Guardar cambios' : 'Crear cliente'}</span>
        <span class="btn-spinner" hidden></span>
      </button>
    `);

    document.getElementById('cliente-form-submit').addEventListener('click', () => {
      if (isEdit) {
        this.updateCliente(item.id);
      } else {
        this.createCliente();
      }
    });
  },

  // ====== CREAR ======
  async createCliente() {
    const form = document.getElementById('cliente-form');
    if (!form.reportValidity()) return;

    const btn = document.getElementById('cliente-form-submit');
    const errorEl = document.getElementById('cliente-form-error');
    errorEl.hidden = true;

    const record = {
      nombre: document.getElementById('cliente-nombre').value.trim(),
      nif: document.getElementById('cliente-nif').value.trim().toUpperCase() || null,
      direccion: document.getElementById('cliente-direccion').value.trim() || null,
      poblacion: document.getElementById('cliente-poblacion').value.trim() || null,
      codigo_postal: document.getElementById('cliente-cp').value.trim() || null,
      provincia: document.getElementById('cliente-provincia').value.trim() || null,
    };

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Creando...';
    btn.querySelector('.btn-spinner').hidden = false;

    try {
      const { error } = await sbInsert('clientes', record);
      if (error) throw new Error(error.message);

      closeModal();
      showToast(`Cliente ${record.nombre} creado`);
      await this.loadClientes();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Crear cliente';
      btn.querySelector('.btn-spinner').hidden = true;
    }
  },

  // ====== ACTUALIZAR ======
  async updateCliente(clienteId) {
    const form = document.getElementById('cliente-form');
    if (!form.reportValidity()) return;

    const btn = document.getElementById('cliente-form-submit');
    const errorEl = document.getElementById('cliente-form-error');
    errorEl.hidden = true;

    const updates = {
      nombre: document.getElementById('cliente-nombre').value.trim(),
      nif: document.getElementById('cliente-nif').value.trim().toUpperCase() || null,
      direccion: document.getElementById('cliente-direccion').value.trim() || null,
      poblacion: document.getElementById('cliente-poblacion').value.trim() || null,
      codigo_postal: document.getElementById('cliente-cp').value.trim() || null,
      provincia: document.getElementById('cliente-provincia').value.trim() || null,
    };

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Guardando...';
    btn.querySelector('.btn-spinner').hidden = false;

    try {
      const { error } = await sbUpdate('clientes', 'id=eq.' + clienteId, updates);
      if (error) throw new Error(error.message);

      closeModal();
      showToast('Cambios guardados');
      await this.loadClientes();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Guardar cambios';
      btn.querySelector('.btn-spinner').hidden = true;
    }
  },

  // ====== ACTIVAR/DESACTIVAR ======
  async toggleActive(clienteId, newState) {
    closeModal();
    const item = this.list.find(c => c.id === clienteId);
    const action = newState ? 'activar' : 'desactivar';

    confirmAction(
      `¿Seguro que quieres ${action} ${item.nombre}?`,
      async () => {
        const { error } = await sbUpdate('clientes', 'id=eq.' + clienteId, { activo: newState });

        if (error) {
          showToast(`Error al ${action}`, 'error');
          return;
        }

        showToast(`${item.nombre} ${newState ? 'activado' : 'desactivado'}`);
        await this.loadClientes();
      }
    );
  },

  // ====== HELPER: obtener clientes activos (para desplegables en DeCA) ======
  getClientesActivos() {
    return this.list.filter(c => c.activo);
  }
};
