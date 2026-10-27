// ============================================================
// DeCA Manager — Gestión de Flota (Vehículos y Remolques)
// Solo Admin
// ============================================================

const Flota = {
  vehiculos: [],
  remolques: [],
  activeTab: 'vehiculos',
  searchQuery: '',

  // ====== RENDERIZAR VISTA PRINCIPAL ======
  async render(container) {
    if (!Auth.isAdmin()) {
      container.innerHTML = '<div class="empty-state"><p>No tienes acceso a esta sección</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="tabs-bar">
        <button class="tab-btn active" data-tab="vehiculos">Vehículos</button>
        <button class="tab-btn" data-tab="remolques">Remolques</button>
      </div>
      <div class="section-header" style="margin-top:12px;">
        <div class="search-inline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="flota-search" placeholder="Buscar matrícula..." style="border:none; outline:none; font-size:14px; background:transparent; flex:1;">
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-flota">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo
        </button>
      </div>
      <div id="flota-list" class="card-list">
        <div class="skeleton" style="height: 72px; margin-bottom: 8px;"></div>
        <div class="skeleton" style="height: 72px; margin-bottom: 8px;"></div>
        <div class="skeleton" style="height: 72px;"></div>
      </div>
    `;

    // Bind tabs
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.searchQuery = '';
        document.getElementById('flota-search').value = '';
        document.getElementById('flota-search').placeholder =
          this.activeTab === 'vehiculos' ? 'Buscar matrícula...' : 'Buscar matrícula...';
        this.renderList();
      });
    });

    // Bind search
    document.getElementById('flota-search').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.renderList();
    });

    // Bind add button
    document.getElementById('btn-add-flota').addEventListener('click', () => this.showForm());

    // Load data
    await Promise.all([this.loadVehiculos(), this.loadRemolques()]);
  },

  // ====== CARGAR DATOS ======
  async loadVehiculos() {
    const { data, error } = await sbSelect('vehiculos', 'select=*&order=matricula.asc');

    if (error) {
      showToast('Error cargando vehículos', 'error');
      console.error(error);
      return;
    }
    this.vehiculos = data || [];
    if (this.activeTab === 'vehiculos') this.renderList();
  },

  async loadRemolques() {
    const { data, error } = await sbSelect('remolques', 'select=*&order=matricula.asc');

    if (error) {
      showToast('Error cargando remolques', 'error');
      console.error(error);
      return;
    }
    this.remolques = data || [];
    if (this.activeTab === 'remolques') this.renderList();
  },

  // ====== RENDERIZAR LISTA ======
  renderList() {
    const container = document.getElementById('flota-list');
    if (!container) return;

    const items = this.activeTab === 'vehiculos' ? this.vehiculos : this.remolques;
    const isVehiculo = this.activeTab === 'vehiculos';

    // Filtrar por búsqueda
    const filtered = this.searchQuery
      ? items.filter(item =>
          item.matricula.toLowerCase().includes(this.searchQuery) ||
          (item.marca || '').toLowerCase().includes(this.searchQuery) ||
          (item.modelo || '').toLowerCase().includes(this.searchQuery)
        )
      : items;

    if (filtered.length === 0) {
      const emptyMsg = this.searchQuery
        ? 'No se encontraron resultados'
        : `No hay ${isVehiculo ? 'vehículos' : 'remolques'} registrados`;

      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            ${isVehiculo
              ? '<rect x="1" y="3" width="15" height="13"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'
              : '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="7" cy="20" r="2"/><circle cx="17" cy="20" r="2"/><line x1="2" y1="12" x2="22" y2="12"/>'
            }
          </svg>
          <p>${emptyMsg}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => {
      const tipoLabel = this.getTipoLabel(item.tipo);
      const icon = isVehiculo ? this.getVehiculoIcon(item.tipo) : this.getRemolqueIcon(item.tipo);

      return `
        <div class="list-card" data-id="${item.id}">
          <div class="list-card-icon">${icon}</div>
          <div class="list-card-info">
            <div class="name">${item.matricula}</div>
            <div class="detail">${tipoLabel}${item.marca ? ' · ' + item.marca : ''}${item.modelo ? ' ' + item.modelo : ''}</div>
          </div>
          <span class="badge badge-${item.activo ? 'activo' : 'inactivo'}">${item.activo ? 'Activo' : 'Inactivo'}</span>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.list-card').forEach(card => {
      card.addEventListener('click', () => {
        const item = (isVehiculo ? this.vehiculos : this.remolques).find(i => i.id === card.dataset.id);
        if (item) this.showDetail(item);
      });
    });
  },

  // ====== DETALLE ======
  showDetail(item) {
    const isVehiculo = this.activeTab === 'vehiculos';
    const tipoLabel = this.getTipoLabel(item.tipo);
    const statusBadge = item.activo
      ? '<span class="badge badge-activo">Activo</span>'
      : '<span class="badge badge-inactivo">Inactivo</span>';

    showModal(item.matricula, `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="list-card-icon" style="width:56px;height:56px;font-size:24px;">
            ${isVehiculo ? this.getVehiculoIcon(item.tipo) : this.getRemolqueIcon(item.tipo)}
          </div>
          <div>
            <span class="badge badge-info" style="margin-bottom:4px;">${tipoLabel}</span>
            ${statusBadge}
          </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div>
            <span style="font-size:12px; color:var(--gray-500);">Matrícula</span>
            <p style="font-size:14px; font-weight:600;">${item.matricula}</p>
          </div>
          <div>
            <span style="font-size:12px; color:var(--gray-500);">Tipo</span>
            <p style="font-size:14px; font-weight:500;">${tipoLabel}</p>
          </div>
          <div>
            <span style="font-size:12px; color:var(--gray-500);">Marca</span>
            <p style="font-size:14px; font-weight:500;">${item.marca || '—'}</p>
          </div>
          <div>
            <span style="font-size:12px; color:var(--gray-500);">Modelo</span>
            <p style="font-size:14px; font-weight:500;">${item.modelo || '—'}</p>
          </div>
          <div>
            <span style="font-size:12px; color:var(--gray-500);">N.º ejes</span>
            <p style="font-size:14px; font-weight:500;">${item.num_ejes || '—'}</p>
          </div>
          <div>
            <span style="font-size:12px; color:var(--gray-500);">Tara (kg)</span>
            <p style="font-size:14px; font-weight:500;">${item.tara ? Number(item.tara).toLocaleString('es-ES') : '—'}</p>
          </div>
          ${isVehiculo ? `
          <div>
            <span style="font-size:12px; color:var(--gray-500);">MMA (kg)</span>
            <p style="font-size:14px; font-weight:500;">${item.mma ? Number(item.mma).toLocaleString('es-ES') : '—'}</p>
          </div>
          ` : ''}
          <div style="grid-column: 1/-1;">
            <span style="font-size:12px; color:var(--gray-500);">Registrado</span>
            <p style="font-size:14px; font-weight:500;">${new Date(item.created_at).toLocaleDateString('es-ES')}</p>
          </div>
        </div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
      <button class="btn btn-primary" onclick="Flota.showForm('${item.id}')">Editar</button>
      <button class="btn ${item.activo ? 'btn-danger' : 'btn-success'} btn-sm" onclick="Flota.toggleActive('${item.id}', ${!item.activo})">${item.activo ? 'Desactivar' : 'Activar'}</button>
    `);
  },

  // ====== FORMULARIO CREAR/EDITAR ======
  showForm(itemId) {
    closeModal();
    const isVehiculo = this.activeTab === 'vehiculos';
    const items = isVehiculo ? this.vehiculos : this.remolques;
    const item = itemId ? items.find(i => i.id === itemId) : null;
    const isEdit = !!item;
    const entityName = isVehiculo ? 'vehículo' : 'remolque';
    const title = isEdit ? `Editar ${entityName}` : `Nuevo ${entityName}`;

    const tiposVehiculo = [
      { value: 'tractora', label: 'Cabeza tractora' },
    ];
    const tiposRemolque = [
      { value: 'remolque', label: 'Remolque' },
      { value: 'plataforma', label: 'Plataforma' },
    ];
    const tipos = isVehiculo ? tiposVehiculo : tiposRemolque;

    const formHTML = `
      <form id="flota-form" style="display:flex; flex-direction:column; gap:4px;">
        <div class="form-row">
          <div class="form-group">
            <label for="flota-matricula">Matrícula *</label>
            <input type="text" id="flota-matricula" required value="${item?.matricula || ''}"
                   placeholder="1234 ABC" style="text-transform:uppercase;">
          </div>
          <div class="form-group">
            <label for="flota-tipo">Tipo *</label>
            <select id="flota-tipo" required>
              ${tipos.map(t => `<option value="${t.value}" ${item?.tipo === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="flota-marca">Marca</label>
            <input type="text" id="flota-marca" value="${item?.marca || ''}" placeholder="Ej: Scania">
          </div>
          <div class="form-group">
            <label for="flota-modelo">Modelo</label>
            <input type="text" id="flota-modelo" value="${item?.modelo || ''}" placeholder="Ej: R450">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="flota-ejes">N.º de ejes</label>
            <input type="number" id="flota-ejes" min="1" max="10" value="${item?.num_ejes || ''}">
          </div>
          <div class="form-group">
            <label for="flota-tara">Tara (kg)</label>
            <input type="number" id="flota-tara" min="0" step="0.01" value="${item?.tara || ''}" placeholder="7500">
          </div>
        </div>
        ${isVehiculo ? `
        <div class="form-row">
          <div class="form-group">
            <label for="flota-mma">MMA (kg)</label>
            <input type="number" id="flota-mma" min="0" step="0.01" value="${item?.mma || ''}" placeholder="40000">
          </div>
          <div class="form-group"></div>
        </div>
        ` : ''}
        <div id="flota-form-error" class="error-msg" hidden></div>
      </form>
    `;

    showModal(title, formHTML, `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="flota-form-submit">
        <span class="btn-text">${isEdit ? 'Guardar cambios' : 'Crear ' + entityName}</span>
        <span class="btn-spinner" hidden></span>
      </button>
    `);

    document.getElementById('flota-form-submit').addEventListener('click', () => {
      if (isEdit) {
        this.updateItem(item.id);
      } else {
        this.createItem();
      }
    });
  },

  // ====== CREAR ======
  async createItem() {
    const form = document.getElementById('flota-form');
    if (!form.reportValidity()) return;

    const btn = document.getElementById('flota-form-submit');
    const errorEl = document.getElementById('flota-form-error');
    errorEl.hidden = true;

    const isVehiculo = this.activeTab === 'vehiculos';
    const table = isVehiculo ? 'vehiculos' : 'remolques';
    const entityName = isVehiculo ? 'Vehículo' : 'Remolque';

    const record = {
      matricula: document.getElementById('flota-matricula').value.trim().toUpperCase(),
      tipo: document.getElementById('flota-tipo').value,
      marca: document.getElementById('flota-marca').value.trim() || null,
      modelo: document.getElementById('flota-modelo').value.trim() || null,
      num_ejes: document.getElementById('flota-ejes').value ? parseInt(document.getElementById('flota-ejes').value) : null,
      tara: document.getElementById('flota-tara').value ? parseFloat(document.getElementById('flota-tara').value) : null,
    };

    // Vehículos tienen también MMA
    if (isVehiculo) {
      record.mma = document.getElementById('flota-mma').value ? parseFloat(document.getElementById('flota-mma').value) : null;
    }

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Creando...';
    btn.querySelector('.btn-spinner').hidden = false;

    try {
      const { error } = await supabase.from(table).insert(record);

      if (error) {
        if (error.code === '23505') {
          throw new Error(`Ya existe un ${entityName.toLowerCase()} con esa matrícula`);
        }
        throw new Error(error.message);
      }

      closeModal();
      showToast(`${entityName} ${record.matricula} creado`);
      if (isVehiculo) await this.loadVehiculos();
      else await this.loadRemolques();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = `Crear ${entityName.toLowerCase()}`;
      btn.querySelector('.btn-spinner').hidden = true;
    }
  },

  // ====== ACTUALIZAR ======
  async updateItem(itemId) {
    const form = document.getElementById('flota-form');
    if (!form.reportValidity()) return;

    const btn = document.getElementById('flota-form-submit');
    const errorEl = document.getElementById('flota-form-error');
    errorEl.hidden = true;

    const isVehiculo = this.activeTab === 'vehiculos';
    const table = isVehiculo ? 'vehiculos' : 'remolques';

    const updates = {
      matricula: document.getElementById('flota-matricula').value.trim().toUpperCase(),
      tipo: document.getElementById('flota-tipo').value,
      marca: document.getElementById('flota-marca').value.trim() || null,
      modelo: document.getElementById('flota-modelo').value.trim() || null,
      num_ejes: document.getElementById('flota-ejes').value ? parseInt(document.getElementById('flota-ejes').value) : null,
      tara: document.getElementById('flota-tara').value ? parseFloat(document.getElementById('flota-tara').value) : null,
    };

    // Vehículos tienen también MMA
    if (isVehiculo) {
      updates.mma = document.getElementById('flota-mma').value ? parseFloat(document.getElementById('flota-mma').value) : null;
    }

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Guardando...';
    btn.querySelector('.btn-spinner').hidden = false;

    try {
      const { error } = await supabase.from(table).update(updates).eq('id', itemId);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Ya existe otro registro con esa matrícula');
        }
        throw new Error(error.message);
      }

      closeModal();
      showToast('Cambios guardados');
      if (isVehiculo) await this.loadVehiculos();
      else await this.loadRemolques();
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
  async toggleActive(itemId, newState) {
    closeModal();
    const isVehiculo = this.activeTab === 'vehiculos';
    const items = isVehiculo ? this.vehiculos : this.remolques;
    const item = items.find(i => i.id === itemId);
    const table = isVehiculo ? 'vehiculos' : 'remolques';
    const action = newState ? 'activar' : 'desactivar';

    confirmAction(
      `¿Seguro que quieres ${action} ${item.matricula}?`,
      async () => {
        const { error } = await supabase.from(table).update({ activo: newState }).eq('id', itemId);

        if (error) {
          showToast(`Error al ${action}`, 'error');
          return;
        }

        showToast(`${item.matricula} ${newState ? 'activado' : 'desactivado'}`);
        if (isVehiculo) await this.loadVehiculos();
        else await this.loadRemolques();
      }
    );
  },

  // ====== HELPERS: LABELS E ICONOS ======
  getTipoLabel(tipo) {
    const labels = {
      tractora: 'Cabeza tractora',
      remolque: 'Remolque',
      plataforma: 'Plataforma',
    };
    return labels[tipo] || tipo;
  },

  getVehiculoIcon(tipo) {
    if (tipo === 'furgoneta') {
      return '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--primary)" stroke-width="1.5"><rect x="1" y="5" width="15" height="11" rx="1"/><path d="M16 9h4l3 4v3h-7V9z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--primary)" stroke-width="1.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
  },

  getRemolqueIcon(tipo) {
    return '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--primary)" stroke-width="1.5"><rect x="2" y="4" width="18" height="12" rx="1"/><circle cx="7" cy="19" r="2.5"/><circle cx="15" cy="19" r="2.5"/><line x1="20" y1="10" x2="23" y2="10"/></svg>';
  },

  // Obtener solo los activos (para usar en otros módulos, ej: crear DeCA)
  getVehiculosActivos() {
    return this.vehiculos.filter(v => v.activo);
  },

  getRemolquesActivos() {
    return this.remolques.filter(r => r.activo);
  }
};
