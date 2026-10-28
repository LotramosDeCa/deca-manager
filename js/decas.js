// ============================================================
// DeCA Manager — Gestión de DeCA (Chunk 3)
// ============================================================

const Decas = {
  list: [],
  vehiculosActivos: [],
  remolquesActivos: [],

  // Datos de empresa (fijos para Lotramos)
  EMPRESA: {
    nombre: 'Lotramos SL',
    nif: 'B45849353',
    direccion: 'AV. Principe, 82 - 45692 Malpica de Tajo',
    num_autorizacion: '', // Alberto rellenará su nº autorización
  },

  // ====== RENDERIZAR VISTA PRINCIPAL ======
  async render(container) {
    const isAdmin = Auth.isAdmin();

    container.innerHTML = `
      <div class="section-header">
        <h3>${isAdmin ? 'Todas las DeCA' : 'Mis DeCA'}</h3>
        ${isAdmin ? `
        <button class="btn btn-primary btn-sm" id="btn-crear-deca">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva DeCA
        </button>
        ` : ''}
      </div>
      <div class="search-inline" style="margin-bottom:12px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="deca-search" placeholder="Buscar referencia, matrícula..." style="border:none; outline:none; font-size:14px; background:transparent; flex:1;">
      </div>
      <div id="deca-list" class="card-list">
        <div class="skeleton" style="height: 80px; margin-bottom: 8px;"></div>
        <div class="skeleton" style="height: 80px; margin-bottom: 8px;"></div>
        <div class="skeleton" style="height: 80px;"></div>
      </div>
    `;

    if (isAdmin) {
      document.getElementById('btn-crear-deca')?.addEventListener('click', () => this.showForm());
    }

    document.getElementById('deca-search').addEventListener('input', (e) => {
      this._searchQuery = e.target.value.trim().toLowerCase();
      this.renderList();
    });

    this._searchQuery = '';
    await this.loadDecas();
  },

  // ====== CARGAR LISTA ======
  async loadDecas() {
    console.log('[DeCA] loadDecas iniciando...');
    try {
      let params = 'select=*&order=created_at.desc';

      // Conductores solo ven las suyas
      if (!Auth.isAdmin()) {
        params += '&conductor_id=eq.' + Auth.currentProfile.id;
      }

      const { data, error } = await sbSelect('decas', params);

      if (error) {
        showToast('Error cargando DeCA', 'error');
        console.error('loadDecas error:', error);
      }

      this.list = data || [];
    } catch (err) {
      console.error('loadDecas exception:', err);
      showToast('Error de conexión', 'error');
      this.list = [];
    }

    // SIEMPRE renderizar, incluso si la lista está vacía por error
    console.log('[DeCA] loadDecas completado, items:', this.list.length);
    this.renderList();
  },

  // ====== RENDERIZAR LISTA ======
  renderList() {
    const container = document.getElementById('deca-list');
    if (!container) return;

    let items = this.list;

    // Filtrar
    if (this._searchQuery) {
      items = items.filter(d =>
        (d.referencia || '').toLowerCase().includes(this._searchQuery) ||
        (d.matricula_vehiculo || '').toLowerCase().includes(this._searchQuery) ||
        (d.origen || '').toLowerCase().includes(this._searchQuery) ||
        (d.destino || '').toLowerCase().includes(this._searchQuery) ||
        (d.nombre_conductor || '').toLowerCase().includes(this._searchQuery)
      );
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <p>${this._searchQuery ? 'No se encontraron resultados' : 'No hay DeCA creadas'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(d => {
      const estadoClass = {
        activo: 'badge-info',
        finalizado: 'badge-success',
        modificado: 'badge-warning',
        anulado: 'badge-danger',
      }[d.estado] || 'badge-info';

      const estadoLabel = {
        activo: 'Activa',
        finalizado: 'Finalizada',
        modificado: 'Modificada',
        anulado: 'Anulada',
      }[d.estado] || d.estado;

      const fecha = d.fecha_transporte
        ? new Date(d.fecha_transporte).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

      return `
        <div class="list-card deca-card" data-id="${d.id}">
          <div class="list-card-icon" style="background:var(--primary-50); color:var(--primary);">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div class="list-card-info">
            <div class="name">${d.referencia || 'Sin ref.'} ${d.version > 1 ? '<span style="color:var(--gray-400)">v' + d.version + '</span>' : ''}</div>
            <div class="detail">${d.origen || '?'} → ${d.destino || '?'}</div>
            <div class="detail">${fecha} · ${d.matricula_vehiculo || '—'} ${d.nombre_conductor ? '· ' + d.nombre_conductor : ''}</div>
          </div>
          <span class="badge ${estadoClass}">${estadoLabel}</span>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.deca-card').forEach(card => {
      card.addEventListener('click', () => {
        const d = this.list.find(x => x.id === card.dataset.id);
        if (d) this.showDetail(d);
      });
    });
  },

  // ====== DETALLE DE UNA DECA ======
  showDetail(d) {
    const fecha = d.fecha_transporte
      ? new Date(d.fecha_transporte).toLocaleDateString('es-ES')
      : '—';

    const estadoLabel = {
      activo: 'Activa', finalizado: 'Finalizada', modificado: 'Modificada', anulado: 'Anulada',
    }[d.estado] || d.estado;

    const estadoClass = {
      activo: 'badge-info', finalizado: 'badge-success', modificado: 'badge-warning', anulado: 'badge-danger',
    }[d.estado] || 'badge-info';

    showModal(d.referencia || 'DeCA', `
      <div style="display:flex; flex-direction:column; gap:14px; max-height:60vh; overflow-y:auto;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span class="badge ${estadoClass}">${estadoLabel}</span>
          ${d.version > 1 ? `<span class="badge badge-info">Version ${d.version}</span>` : ''}
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Referencia</span>
            <p style="font-size:13px; font-weight:600;">${d.referencia || '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">N. expedicion</span>
            <p style="font-size:13px; font-weight:500;">${d.num_expedicion || '—'}</p>
          </div>
        </div>

        ${(d.nombre_cargador || d.nombre_destinatario) ? `
        <hr style="border:none; border-top:1px solid var(--gray-200); margin:2px 0;">
        <p style="font-size:11px; color:var(--primary); font-weight:600; text-transform:uppercase; margin-bottom:-6px;">Partes intervinientes</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Cargador</span>
            <p style="font-size:13px; font-weight:500;">${d.nombre_cargador || '—'}</p>
            <p style="font-size:11px; color:var(--gray-500);">${d.nif_cargador || ''}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Destinatario</span>
            <p style="font-size:13px; font-weight:500;">${d.nombre_destinatario || '—'}</p>
            <p style="font-size:11px; color:var(--gray-500);">${d.nif_destinatario || ''}</p>
          </div>
        </div>
        ` : ''}

        <hr style="border:none; border-top:1px solid var(--gray-200); margin:2px 0;">
        <p style="font-size:11px; color:var(--primary); font-weight:600; text-transform:uppercase; margin-bottom:-6px;">Envio</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Fecha transporte</span>
            <p style="font-size:13px; font-weight:500;">${fecha}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Hora carga</span>
            <p style="font-size:13px; font-weight:500;">${d.hora_carga || '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Lugar de carga</span>
            <p style="font-size:13px; font-weight:500;">${d.origen || '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Lugar de descarga</span>
            <p style="font-size:13px; font-weight:500;">${d.destino || '—'}</p>
          </div>
          <div style="grid-column:1/-1;">
            <span style="font-size:11px; color:var(--gray-500);">Mercancia</span>
            <p style="font-size:13px; font-weight:500;">${d.descripcion_mercancia || '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Peso (kg)</span>
            <p style="font-size:13px; font-weight:500;">${d.peso ? Number(d.peso).toLocaleString('es-ES') : '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Bultos</span>
            <p style="font-size:13px; font-weight:500;">${d.bultos || '—'}</p>
          </div>
        </div>

        <hr style="border:none; border-top:1px solid var(--gray-200); margin:2px 0;">
        <p style="font-size:11px; color:var(--primary); font-weight:600; text-transform:uppercase; margin-bottom:-6px;">Vehiculo y conductor</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Conductor</span>
            <p style="font-size:13px; font-weight:500;">${d.nombre_conductor || '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">DNI conductor</span>
            <p style="font-size:13px; font-weight:500;">${d.dni_conductor || '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Vehiculo</span>
            <p style="font-size:13px; font-weight:500;">${d.matricula_vehiculo || '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Remolque</span>
            <p style="font-size:13px; font-weight:500;">${d.matricula_remolque || '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Empresa</span>
            <p style="font-size:13px; font-weight:500;">${d.empresa || '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">NIF empresa</span>
            <p style="font-size:13px; font-weight:500;">${d.nif_empresa || '—'}</p>
          </div>
        </div>
      </div>
    `, `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; width:100%;">
        <button class="btn btn-primary" style="background:#7c3aed; justify-content:center;" onclick="Decas.mostrarQR('${d.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><line x1="20" y1="14" x2="20" y2="20"/><line x1="14" y1="20" x2="20" y2="20"/></svg>
          QR
        </button>
        <button class="btn btn-primary" style="justify-content:center;" onclick="Decas.generarPDF('${d.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          PDF
        </button>
        ${(d.estado === 'activo' || d.estado === 'modificado') ? `
        <button class="btn btn-primary" style="background:#f59e0b; justify-content:center;" onclick="Decas.showEditForm('${d.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar
        </button>
        <button class="btn btn-primary" style="background:#059669; justify-content:center;" onclick="Decas.cambiarEstado('${d.id}', 'finalizado')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          Finalizar
        </button>
        <button class="btn btn-secondary" style="color:var(--danger); border-color:var(--danger); justify-content:center;" onclick="Decas.cambiarEstado('${d.id}', 'anulado')">Anular</button>
        ` : `
        <button class="btn btn-secondary" style="grid-column:1/-1; justify-content:center;" onclick="closeModal()">Cerrar</button>
        `}
      </div>
    `);
  },

  // ====== FORMULARIO CREAR DECA ======
  async showForm() {
    closeModal();

    // Cargar vehículos, remolques, conductores y clientes en paralelo
    const [vehiculos, remolques, conductores, clientesRes] = await Promise.all([
      sbSelect('vehiculos', 'select=id,matricula,marca,modelo&activo=eq.true&order=matricula.asc'),
      sbSelect('remolques', 'select=id,matricula,marca,modelo&activo=eq.true&order=matricula.asc'),
      sbSelect('profiles', 'select=id,user_id,nombre,apellidos,dni&activo=eq.true&rol=eq.conductor&order=nombre.asc'),
      sbSelect('clientes', 'select=id,nombre,nif,direccion,poblacion,codigo_postal,provincia&activo=eq.true&order=nombre.asc'),
    ]);

    this.vehiculosActivos = vehiculos.data || [];
    this.remolquesActivos = remolques.data || [];
    const conductoresActivos = conductores.data || [];
    this._clientesActivos = clientesRes.data || [];

    // Incluir admins también como posibles conductores
    const admins = await sbSelect('profiles', 'select=id,user_id,nombre,apellidos,dni&activo=eq.true&rol=eq.admin&order=nombre.asc');
    const todosConductores = [...conductoresActivos, ...(admins.data || [])];

    const hoy = new Date().toISOString().split('T')[0];

    // Construir opciones de clientes con data-* para copiar datos al registro
    const clienteOptions = this._clientesActivos.map(c => {
      const dir = [c.direccion, c.poblacion, c.codigo_postal, c.provincia].filter(Boolean).join(', ');
      return `<option value="${c.id}" data-nombre="${c.nombre}" data-nif="${c.nif || ''}" data-direccion="${dir}">${c.nombre}${c.nif ? ' (' + c.nif + ')' : ''}</option>`;
    }).join('');

    const formHTML = `
      <form id="deca-form" style="display:flex; flex-direction:column; gap:4px; max-height:65vh; overflow-y:auto; padding-right:4px;">

        <p style="font-size:12px; color:var(--gray-500); margin-bottom:4px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Partes intervinientes</p>

        <div class="form-group">
          <label for="deca-cargador">Cargador / Expedidor *</label>
          <select id="deca-cargador" required>
            <option value="">Seleccionar cargador</option>
            ${clienteOptions}
          </select>
        </div>

        <div class="form-group">
          <label for="deca-destinatario">Destinatario *</label>
          <select id="deca-destinatario" required>
            <option value="">Seleccionar destinatario</option>
            ${clienteOptions}
          </select>
        </div>

        <hr style="border:none; border-top:1px solid var(--gray-200); margin:8px 0;">
        <p style="font-size:12px; color:var(--gray-500); margin-bottom:4px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Datos del envio</p>

        <div class="form-row">
          <div class="form-group">
            <label for="deca-fecha">Fecha de transporte *</label>
            <input type="date" id="deca-fecha" required value="${hoy}">
          </div>
          <div class="form-group">
            <label for="deca-hora-carga">Hora de carga</label>
            <input type="time" id="deca-hora-carga">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="deca-origen">Lugar de carga *</label>
            <input type="text" id="deca-origen" required placeholder="Ciudad o dirección">
          </div>
          <div class="form-group">
            <label for="deca-destino">Lugar de descarga *</label>
            <input type="text" id="deca-destino" required placeholder="Ciudad o dirección">
          </div>
        </div>

        <div class="form-group">
          <label for="deca-mercancia">Naturaleza de la mercancia *</label>
          <input type="text" id="deca-mercancia" required placeholder="Ej: Material de construcción">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="deca-peso">Peso (kg) *</label>
            <input type="number" id="deca-peso" min="0" step="0.01" required placeholder="0">
          </div>
          <div class="form-group">
            <label for="deca-bultos">Bultos</label>
            <input type="number" id="deca-bultos" min="0" placeholder="0">
          </div>
        </div>

        <hr style="border:none; border-top:1px solid var(--gray-200); margin:8px 0;">
        <p style="font-size:12px; color:var(--gray-500); margin-bottom:4px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Conductor y vehiculo</p>

        <div class="form-group">
          <label for="deca-conductor">Conductor *</label>
          <select id="deca-conductor" required>
            <option value="">Seleccionar conductor</option>
            ${todosConductores.map(c => `<option value="${c.id}" data-nombre="${c.nombre} ${c.apellidos}" data-dni="${c.dni || ''}">${c.nombre} ${c.apellidos}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="deca-vehiculo">Vehiculo *</label>
          <select id="deca-vehiculo" required>
            <option value="">Seleccionar vehiculo</option>
            ${this.vehiculosActivos.map(v => `<option value="${v.id}" data-matricula="${v.matricula}">${v.matricula}${v.marca ? ' -- ' + v.marca : ''}${v.modelo ? ' ' + v.modelo : ''}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="deca-remolque">Remolque</label>
          <select id="deca-remolque">
            <option value="">Sin remolque</option>
            ${this.remolquesActivos.map(r => `<option value="${r.id}" data-matricula="${r.matricula}">${r.matricula}${r.marca ? ' -- ' + r.marca : ''}${r.modelo ? ' ' + r.modelo : ''}</option>`).join('')}
          </select>
        </div>

        <div id="deca-form-error" class="error-msg" hidden></div>
      </form>
    `;

    showModal('Nueva DeCA', formHTML, `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="deca-form-submit">
        <span class="btn-text">Crear DeCA</span>
        <span class="btn-spinner" hidden></span>
      </button>
    `);

    document.getElementById('deca-form-submit').addEventListener('click', () => this.previsualizarDeca());
  },

  // ====== PREVISUALIZAR ANTES DE CREAR ======
  previsualizarDeca() {
    const form = document.getElementById('deca-form');
    if (!form.reportValidity()) return;

    // Recoger datos del formulario
    const cargadorSelect = document.getElementById('deca-cargador');
    const destinatarioSelect = document.getElementById('deca-destinatario');
    const conductorSelect = document.getElementById('deca-conductor');
    const vehiculoSelect = document.getElementById('deca-vehiculo');
    const remolqueSelect = document.getElementById('deca-remolque');

    const cargadorOption = cargadorSelect.selectedOptions[0];
    const destinatarioOption = destinatarioSelect.selectedOptions[0];
    const conductorOption = conductorSelect.selectedOptions[0];
    const vehiculoOption = vehiculoSelect.selectedOptions[0];
    const remolqueOption = remolqueSelect.selectedOptions[0];

    const fecha = document.getElementById('deca-fecha').value;
    const horaCarga = document.getElementById('deca-hora-carga').value || null;
    const fechaFormateada = fecha
      ? new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—';

    // Guardar datos temporalmente para la confirmación
    this._pendingRecord = {
      fecha_transporte: fecha,
      hora_carga: horaCarga,
      origen: document.getElementById('deca-origen').value.trim(),
      destino: document.getElementById('deca-destino').value.trim(),
      descripcion_mercancia: document.getElementById('deca-mercancia').value.trim(),
      peso: document.getElementById('deca-peso').value ? parseFloat(document.getElementById('deca-peso').value) : null,
      bultos: document.getElementById('deca-bultos').value ? parseInt(document.getElementById('deca-bultos').value) : null,
      // Cargador
      cargador_id: cargadorSelect.value,
      nombre_cargador: cargadorOption?.dataset.nombre || '',
      nif_cargador: cargadorOption?.dataset.nif || '',
      direccion_cargador: cargadorOption?.dataset.direccion || '',
      // Destinatario
      destinatario_id: destinatarioSelect.value,
      nombre_destinatario: destinatarioOption?.dataset.nombre || '',
      nif_destinatario: destinatarioOption?.dataset.nif || '',
      direccion_destinatario: destinatarioOption?.dataset.direccion || '',
      // Vehiculo y conductor
      vehiculo_id: vehiculoSelect.value,
      matricula_vehiculo: vehiculoOption?.dataset.matricula || '',
      remolque_id: remolqueSelect.value || null,
      matricula_remolque: remolqueOption?.dataset.matricula || null,
      conductor_id: conductorSelect.value,
      nombre_conductor: conductorOption?.dataset.nombre || '',
      dni_conductor: conductorOption?.dataset.dni || '',
    };

    const r = this._pendingRecord;

    // Mostrar resumen para confirmar
    showModal('Confirmar DeCA', `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <p style="font-size:13px; color:var(--gray-500); margin-bottom:4px;">Revisa los datos antes de crear la DeCA:</p>

        <div style="background:var(--gray-50); border-radius:10px; padding:14px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <p style="font-size:11px; color:var(--primary); font-weight:600; text-transform:uppercase; grid-column:1/-1; margin-bottom:2px;">Partes intervinientes</p>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Cargador</span>
            <p style="font-size:13px; font-weight:600;">${r.nombre_cargador}</p>
            <p style="font-size:11px; color:var(--gray-500);">${r.nif_cargador || ''}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Destinatario</span>
            <p style="font-size:13px; font-weight:600;">${r.nombre_destinatario}</p>
            <p style="font-size:11px; color:var(--gray-500);">${r.nif_destinatario || ''}</p>
          </div>
        </div>

        <div style="background:var(--gray-50); border-radius:10px; padding:14px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <p style="font-size:11px; color:var(--primary); font-weight:600; text-transform:uppercase; grid-column:1/-1; margin-bottom:2px;">Envio</p>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Fecha</span>
            <p style="font-size:13px; font-weight:600;">${fechaFormateada}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Hora carga</span>
            <p style="font-size:13px; font-weight:500;">${r.hora_carga || '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Lugar de carga</span>
            <p style="font-size:13px; font-weight:600;">${r.origen}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Lugar de descarga</span>
            <p style="font-size:13px; font-weight:600;">${r.destino}</p>
          </div>
          <div style="grid-column:1/-1;">
            <span style="font-size:11px; color:var(--gray-500);">Mercancia</span>
            <p style="font-size:13px; font-weight:500;">${r.descripcion_mercancia}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Peso</span>
            <p style="font-size:13px; font-weight:500;">${r.peso ? Number(r.peso).toLocaleString('es-ES') + ' kg' : '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Bultos</span>
            <p style="font-size:13px; font-weight:500;">${r.bultos || '—'}</p>
          </div>
        </div>

        <div style="background:var(--gray-50); border-radius:10px; padding:14px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <p style="font-size:11px; color:var(--primary); font-weight:600; text-transform:uppercase; grid-column:1/-1; margin-bottom:2px;">Vehiculo y conductor</p>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Conductor</span>
            <p style="font-size:13px; font-weight:500;">${r.nombre_conductor}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">DNI</span>
            <p style="font-size:13px; font-weight:500;">${r.dni_conductor || '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Vehiculo</span>
            <p style="font-size:13px; font-weight:500;">${r.matricula_vehiculo}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Remolque</span>
            <p style="font-size:13px; font-weight:500;">${r.matricula_remolque || 'Sin remolque'}</p>
          </div>
        </div>

        <div id="deca-confirm-error" class="error-msg" hidden></div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="Decas.showForm()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        Volver
      </button>
      <button class="btn btn-primary" id="deca-confirm-btn">
        <span class="btn-text">Confirmar y crear</span>
        <span class="btn-spinner" hidden></span>
      </button>
    `);

    document.getElementById('deca-confirm-btn').addEventListener('click', () => this.crearDeca());
  },

  // ====== CREAR DECA (después de confirmar) ======
  async crearDeca() {
    const btn = document.getElementById('deca-confirm-btn');
    const errorEl = document.getElementById('deca-confirm-error');
    if (!errorEl || !btn) return;
    errorEl.hidden = true;

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Creando...';
    btn.querySelector('.btn-spinner').hidden = false;

    try {
      const r = this._pendingRecord;
      if (!r) throw new Error('No hay datos pendientes');
      const referencia = this.generarReferencia();
      const qrUrl = `https://deca-manager.netlify.app/deca.html?ref=${referencia}`;

      // Auto-generar num_expedicion = referencia
      const numExpedicion = referencia;

      const record = {
        referencia,
        version: 1,
        estado: 'activo',
        fecha_transporte: r.fecha_transporte,
        hora_carga: r.hora_carga,
        num_expedicion: numExpedicion,
        origen: r.origen,
        destino: r.destino,
        descripcion_mercancia: r.descripcion_mercancia,
        peso: r.peso,
        bultos: r.bultos,
        // Cargador
        cargador_id: r.cargador_id,
        nombre_cargador: r.nombre_cargador,
        nif_cargador: r.nif_cargador,
        direccion_cargador: r.direccion_cargador,
        // Destinatario
        destinatario_id: r.destinatario_id,
        nombre_destinatario: r.nombre_destinatario,
        nif_destinatario: r.nif_destinatario,
        direccion_destinatario: r.direccion_destinatario,
        // Vehiculo y conductor
        vehiculo_id: r.vehiculo_id,
        matricula_vehiculo: r.matricula_vehiculo,
        remolque_id: r.remolque_id,
        matricula_remolque: r.matricula_remolque,
        conductor_id: r.conductor_id,
        nombre_conductor: r.nombre_conductor,
        dni_conductor: r.dni_conductor,
        empresa: this.EMPRESA.nombre,
        nif_empresa: this.EMPRESA.nif || null,
        num_autorizacion: this.EMPRESA.num_autorizacion || null,
        qr_code: qrUrl,
        creado_por: Auth.currentProfile.id,
      };

      console.log('[DeCA] Insertando...', referencia);
      const { data: inserted, error } = await sbInsert('decas', record);
      if (error) throw new Error(error.message);
      const data = Array.isArray(inserted) ? inserted[0] : inserted;
      console.log('[DeCA] Creada OK:', referencia);

      closeModal();
      showToast(`DeCA ${referencia} creada`);
      this._pendingRecord = null;

      console.log('[DeCA] Recargando lista...');
      await this.loadDecas();
      console.log('[DeCA] Lista recargada OK');

    } catch (err) {
      console.error('[DeCA] Error creando:', err);
      const modal = document.getElementById('modal-overlay');
      if (errorEl && modal && !modal.hidden) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      } else {
        showToast(err.message || 'Error al crear DeCA', 'error');
      }
    } finally {
      if (btn && btn.isConnected) {
        btn.disabled = false;
        const txt = btn.querySelector('.btn-text');
        const sp = btn.querySelector('.btn-spinner');
        if (txt) txt.textContent = 'Confirmar y crear';
        if (sp) sp.hidden = true;
      }
    }
  },

  // ====== GENERAR REFERENCIA ÚNICA ======
  generarReferencia() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `DECA-${y}${m}${d}-${rand}`;
  },

  // ====== GENERAR PDF CON QR ======
  async generarPDF(decaId) {
    const deca = this.list.find(d => d.id === decaId);
    if (!deca) {
      // Cargar si no está en la lista
      const { data } = await sbSelect('decas', 'select=*&id=eq.' + decaId);
      const fila = Array.isArray(data) ? data[0] : data;
      if (!fila) { showToast('DeCA no encontrada', 'error'); return; }
      this._generarPDFConDatos(fila);
      return;
    }
    this._generarPDFConDatos(deca);
  },

  // ====== MOSTRAR QR EN PANTALLA (para Guardia Civil) ======
  mostrarQR(decaId) {
    const d = this.list.find(x => x.id === decaId);
    if (!d) { showToast('DeCA no encontrada', 'error'); return; }

    const qrUrl = d.qr_code || `https://deca-manager.netlify.app/deca.html?ref=${d.referencia}`;

    // Crear overlay a pantalla completa
    const overlay = document.createElement('div');
    overlay.id = 'qr-fullscreen';
    overlay.style.cssText = `
      position:fixed; top:0; left:0; right:0; bottom:0;
      background:white; z-index:10000;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:24px;
    `;

    overlay.innerHTML = `
      <div style="text-align:center; width:100%; max-width:400px;">
        <div style="margin-bottom:16px;">
          <svg width="40" height="40" viewBox="0 0 56 56" fill="none">
            <rect width="56" height="56" rx="14" fill="#1a56db"/>
            <path d="M16 18h24v4H16zM16 26h24v4H16zM16 34h16v4H16zM38 30l6 8h-12z" fill="white"/>
          </svg>
        </div>
        <h2 style="font-size:18px; font-weight:700; color:#111827; margin-bottom:4px;">DeCA — ${d.referencia}</h2>
        <p style="font-size:13px; color:#6b7280; margin-bottom:20px;">${d.origen || '?'} → ${d.destino || '?'} · ${d.fecha_transporte ? new Date(d.fecha_transporte).toLocaleDateString('es-ES') : '—'}</p>
        <canvas id="qr-canvas-full" style="width:260px; height:260px; border:3px solid #e5e7eb; border-radius:12px; padding:12px; background:white;"></canvas>
        <p style="font-size:12px; color:#9ca3af; margin-top:12px;">Escanear para descargar el documento DeCA</p>
        <p style="font-size:11px; color:#d1d5db; margin-top:4px;">Conforme a Orden TRM/282/2026</p>
        <button id="qr-close-btn" style="
          margin-top:24px; padding:14px 40px;
          background:#1a56db; color:white; border:none; border-radius:10px;
          font-size:15px; font-weight:600; cursor:pointer; font-family:inherit;
        ">Cerrar</button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Generar QR con QRious directamente en el canvas
    if (typeof QRious !== 'undefined') {
      const canvas = document.getElementById('qr-canvas-full');
      new QRious({
        element: canvas,
        value: qrUrl,
        size: 520,
        level: 'M',
        backgroundAlpha: 1,
        foreground: '#000000',
        background: '#ffffff',
      });
    }

    // Cerrar
    document.getElementById('qr-close-btn').addEventListener('click', () => {
      overlay.remove();
    });
  },

  // ====== FORMULARIO EDITAR DECA ======
  async showEditForm(decaId) {
    closeModal();

    // Buscar la DeCA en la lista cargada
    let deca = this.list.find(d => d.id === decaId);
    if (!deca) {
      const { data } = await sbSelect('decas', 'select=*&id=eq.' + decaId);
      deca = Array.isArray(data) ? data[0] : data;
    }
    if (!deca) { showToast('DeCA no encontrada', 'error'); return; }
    if (deca.estado !== 'activo' && deca.estado !== 'modificado') {
      showToast('Solo se pueden editar DeCA activas o modificadas', 'error');
      return;
    }

    // Guardar datos originales para comparar después
    this._editOriginal = { ...deca };

    // Cargar listas en paralelo
    const [vehiculos, remolques, conductores, clientesRes] = await Promise.all([
      sbSelect('vehiculos', 'select=id,matricula,marca,modelo&activo=eq.true&order=matricula.asc'),
      sbSelect('remolques', 'select=id,matricula,marca,modelo&activo=eq.true&order=matricula.asc'),
      sbSelect('profiles', 'select=id,user_id,nombre,apellidos,dni&activo=eq.true&rol=eq.conductor&order=nombre.asc'),
      sbSelect('clientes', 'select=id,nombre,nif,direccion,poblacion,codigo_postal,provincia&activo=eq.true&order=nombre.asc'),
    ]);

    this.vehiculosActivos = vehiculos.data || [];
    this.remolquesActivos = remolques.data || [];
    const conductoresActivos = conductores.data || [];
    this._clientesActivos = clientesRes.data || [];

    const admins = await sbSelect('profiles', 'select=id,user_id,nombre,apellidos,dni&activo=eq.true&rol=eq.admin&order=nombre.asc');
    const todosConductores = [...conductoresActivos, ...(admins.data || [])];

    // Construir opciones con pre-selección
    const clienteOptions = this._clientesActivos.map(c => {
      const dir = [c.direccion, c.poblacion, c.codigo_postal, c.provincia].filter(Boolean).join(', ');
      return `<option value="${c.id}" data-nombre="${c.nombre}" data-nif="${c.nif || ''}" data-direccion="${dir}">${c.nombre}${c.nif ? ' (' + c.nif + ')' : ''}</option>`;
    }).join('');

    const formHTML = `
      <form id="deca-form" style="display:flex; flex-direction:column; gap:4px; max-height:65vh; overflow-y:auto; padding-right:4px;">

        <div style="background:var(--warning-bg, #fef3c7); border-radius:8px; padding:8px 12px; margin-bottom:4px;">
          <p style="font-size:12px; color:#92400e; font-weight:600;">Editando: ${deca.referencia} (v${deca.version})</p>
        </div>

        <p style="font-size:12px; color:var(--gray-500); margin-bottom:4px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Partes intervinientes</p>

        <div class="form-group">
          <label for="deca-cargador">Cargador / Expedidor *</label>
          <select id="deca-cargador" required>
            <option value="">Seleccionar cargador</option>
            ${clienteOptions}
          </select>
        </div>

        <div class="form-group">
          <label for="deca-destinatario">Destinatario *</label>
          <select id="deca-destinatario" required>
            <option value="">Seleccionar destinatario</option>
            ${clienteOptions}
          </select>
        </div>

        <hr style="border:none; border-top:1px solid var(--gray-200); margin:8px 0;">
        <p style="font-size:12px; color:var(--gray-500); margin-bottom:4px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Datos del envio</p>

        <div class="form-row">
          <div class="form-group">
            <label for="deca-fecha">Fecha de transporte *</label>
            <input type="date" id="deca-fecha" required value="${deca.fecha_transporte || ''}">
          </div>
          <div class="form-group">
            <label for="deca-hora-carga">Hora de carga</label>
            <input type="time" id="deca-hora-carga" value="${deca.hora_carga || ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="deca-origen">Lugar de carga *</label>
            <input type="text" id="deca-origen" required placeholder="Ciudad o dirección" value="${deca.origen || ''}">
          </div>
          <div class="form-group">
            <label for="deca-destino">Lugar de descarga *</label>
            <input type="text" id="deca-destino" required placeholder="Ciudad o dirección" value="${deca.destino || ''}">
          </div>
        </div>

        <div class="form-group">
          <label for="deca-mercancia">Naturaleza de la mercancia *</label>
          <input type="text" id="deca-mercancia" required placeholder="Ej: Material de construcción" value="${deca.descripcion_mercancia || ''}">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="deca-peso">Peso (kg) *</label>
            <input type="number" id="deca-peso" min="0" step="0.01" required placeholder="0" value="${deca.peso || ''}">
          </div>
          <div class="form-group">
            <label for="deca-bultos">Bultos</label>
            <input type="number" id="deca-bultos" min="0" placeholder="0" value="${deca.bultos || ''}">
          </div>
        </div>

        <hr style="border:none; border-top:1px solid var(--gray-200); margin:8px 0;">
        <p style="font-size:12px; color:var(--gray-500); margin-bottom:4px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Conductor y vehiculo</p>

        <div class="form-group">
          <label for="deca-conductor">Conductor *</label>
          <select id="deca-conductor" required>
            <option value="">Seleccionar conductor</option>
            ${todosConductores.map(c => `<option value="${c.id}" data-nombre="${c.nombre} ${c.apellidos}" data-dni="${c.dni || ''}">${c.nombre} ${c.apellidos}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="deca-vehiculo">Vehiculo *</label>
          <select id="deca-vehiculo" required>
            <option value="">Seleccionar vehiculo</option>
            ${this.vehiculosActivos.map(v => `<option value="${v.id}" data-matricula="${v.matricula}">${v.matricula}${v.marca ? ' -- ' + v.marca : ''}${v.modelo ? ' ' + v.modelo : ''}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="deca-remolque">Remolque</label>
          <select id="deca-remolque">
            <option value="">Sin remolque</option>
            ${this.remolquesActivos.map(r => `<option value="${r.id}" data-matricula="${r.matricula}">${r.matricula}${r.marca ? ' -- ' + r.marca : ''}${r.modelo ? ' ' + r.modelo : ''}</option>`).join('')}
          </select>
        </div>

        <div id="deca-form-error" class="error-msg" hidden></div>
      </form>
    `;

    showModal('Editar DeCA', formHTML, `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="deca-form-submit" style="background:#f59e0b;">
        <span class="btn-text">Previsualizar cambios</span>
        <span class="btn-spinner" hidden></span>
      </button>
    `);

    // Pre-seleccionar los dropdowns con los valores actuales
    const setCargador = document.getElementById('deca-cargador');
    const setDestinatario = document.getElementById('deca-destinatario');
    const setConductor = document.getElementById('deca-conductor');
    const setVehiculo = document.getElementById('deca-vehiculo');
    const setRemolque = document.getElementById('deca-remolque');

    if (deca.cargador_id && setCargador) setCargador.value = deca.cargador_id;
    if (deca.destinatario_id && setDestinatario) setDestinatario.value = deca.destinatario_id;
    if (deca.conductor_id && setConductor) setConductor.value = deca.conductor_id;
    if (deca.vehiculo_id && setVehiculo) setVehiculo.value = deca.vehiculo_id;
    if (deca.remolque_id && setRemolque) setRemolque.value = deca.remolque_id;

    document.getElementById('deca-form-submit').addEventListener('click', () => this.previsualizarEdicion(decaId));
  },

  // ====== PREVISUALIZAR CAMBIOS ANTES DE GUARDAR ======
  previsualizarEdicion(decaId) {
    const form = document.getElementById('deca-form');
    if (!form.reportValidity()) return;

    const orig = this._editOriginal;
    if (!orig) { showToast('Error: datos originales no encontrados', 'error'); return; }

    // Recoger datos nuevos del formulario
    const cargadorSelect = document.getElementById('deca-cargador');
    const destinatarioSelect = document.getElementById('deca-destinatario');
    const conductorSelect = document.getElementById('deca-conductor');
    const vehiculoSelect = document.getElementById('deca-vehiculo');
    const remolqueSelect = document.getElementById('deca-remolque');

    const cargadorOption = cargadorSelect.selectedOptions[0];
    const destinatarioOption = destinatarioSelect.selectedOptions[0];
    const conductorOption = conductorSelect.selectedOptions[0];
    const vehiculoOption = vehiculoSelect.selectedOptions[0];
    const remolqueOption = remolqueSelect.selectedOptions[0];

    this._editNewData = {
      fecha_transporte: document.getElementById('deca-fecha').value,
      hora_carga: document.getElementById('deca-hora-carga').value || null,
      origen: document.getElementById('deca-origen').value.trim(),
      destino: document.getElementById('deca-destino').value.trim(),
      descripcion_mercancia: document.getElementById('deca-mercancia').value.trim(),
      peso: document.getElementById('deca-peso').value ? parseFloat(document.getElementById('deca-peso').value) : null,
      bultos: document.getElementById('deca-bultos').value ? parseInt(document.getElementById('deca-bultos').value) : null,
      cargador_id: cargadorSelect.value,
      nombre_cargador: cargadorOption?.dataset.nombre || '',
      nif_cargador: cargadorOption?.dataset.nif || '',
      direccion_cargador: cargadorOption?.dataset.direccion || '',
      destinatario_id: destinatarioSelect.value,
      nombre_destinatario: destinatarioOption?.dataset.nombre || '',
      nif_destinatario: destinatarioOption?.dataset.nif || '',
      direccion_destinatario: destinatarioOption?.dataset.direccion || '',
      vehiculo_id: vehiculoSelect.value,
      matricula_vehiculo: vehiculoOption?.dataset.matricula || '',
      remolque_id: remolqueSelect.value || null,
      matricula_remolque: remolqueOption?.dataset.matricula || null,
      conductor_id: conductorSelect.value,
      nombre_conductor: conductorOption?.dataset.nombre || '',
      dni_conductor: conductorOption?.dataset.dni || '',
    };

    // Campos que se comparan (etiqueta legible + campo DB)
    const camposComparar = [
      { key: 'nombre_cargador', label: 'Cargador' },
      { key: 'nif_cargador', label: 'NIF Cargador' },
      { key: 'direccion_cargador', label: 'Dir. Cargador' },
      { key: 'nombre_destinatario', label: 'Destinatario' },
      { key: 'nif_destinatario', label: 'NIF Destinatario' },
      { key: 'direccion_destinatario', label: 'Dir. Destinatario' },
      { key: 'fecha_transporte', label: 'Fecha transporte' },
      { key: 'hora_carga', label: 'Hora carga' },
      { key: 'origen', label: 'Lugar de carga' },
      { key: 'destino', label: 'Lugar de descarga' },
      { key: 'descripcion_mercancia', label: 'Mercancia' },
      { key: 'peso', label: 'Peso (kg)' },
      { key: 'bultos', label: 'Bultos' },
      { key: 'nombre_conductor', label: 'Conductor' },
      { key: 'dni_conductor', label: 'DNI Conductor' },
      { key: 'matricula_vehiculo', label: 'Vehiculo' },
      { key: 'matricula_remolque', label: 'Remolque' },
    ];

    // Detectar cambios
    const cambios = [];
    for (const c of camposComparar) {
      const antes = String(orig[c.key] ?? '');
      const despues = String(this._editNewData[c.key] ?? '');
      if (antes !== despues) {
        cambios.push({ key: c.key, label: c.label, antes, despues });
      }
    }

    // También guardar cambios de IDs (cargador_id, destinatario_id, etc.) para el UPDATE
    const idCampos = ['cargador_id', 'destinatario_id', 'vehiculo_id', 'remolque_id', 'conductor_id'];
    for (const k of idCampos) {
      const antes = String(orig[k] ?? '');
      const despues = String(this._editNewData[k] ?? '');
      if (antes !== despues) {
        // Si ya no está en cambios (por el campo visible), añadirlo
        if (!cambios.find(c => c.key === k)) {
          cambios.push({ key: k, label: k, antes, despues });
        }
      }
    }

    if (cambios.length === 0) {
      showToast('No hay cambios que guardar', 'info');
      return;
    }

    this._editCambios = cambios;

    // Mostrar resumen de cambios
    const cambiosHTML = cambios
      .filter(c => !c.key.endsWith('_id')) // No mostrar IDs al usuario
      .map(c => `
        <div style="padding:8px 0; border-bottom:1px solid var(--gray-100);">
          <span style="font-size:11px; color:var(--gray-500); font-weight:600;">${c.label}</span>
          <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
            <span style="font-size:12px; color:var(--danger); text-decoration:line-through;">${c.antes || '(vacio)'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            <span style="font-size:12px; color:#059669; font-weight:600;">${c.despues || '(vacio)'}</span>
          </div>
        </div>
      `).join('');

    showModal('Confirmar cambios', `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="background:var(--warning-bg, #fef3c7); border-radius:8px; padding:10px 12px;">
          <p style="font-size:12px; color:#92400e; font-weight:600;">${orig.referencia} -- Version ${orig.version} a ${orig.version + 1}</p>
          <p style="font-size:11px; color:#92400e;">${cambios.filter(c => !c.key.endsWith('_id')).length} campo(s) modificado(s)</p>
        </div>
        <div style="background:var(--gray-50); border-radius:10px; padding:12px; max-height:40vh; overflow-y:auto;">
          ${cambiosHTML}
        </div>
        <div id="deca-edit-error" class="error-msg" hidden></div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="Decas.showEditForm('${decaId}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        Volver
      </button>
      <button class="btn btn-primary" id="deca-edit-confirm" style="background:#f59e0b;">
        <span class="btn-text">Guardar cambios</span>
        <span class="btn-spinner" hidden></span>
      </button>
    `);

    document.getElementById('deca-edit-confirm').addEventListener('click', () => this.editarDeca(decaId));
  },

  // ====== GUARDAR EDICIÓN CON HISTORIAL ======
  async editarDeca(decaId) {
    const btn = document.getElementById('deca-edit-confirm');
    const errorEl = document.getElementById('deca-edit-error');
    if (!btn) return;
    if (errorEl) errorEl.hidden = true;

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Guardando...';
    btn.querySelector('.btn-spinner').hidden = false;

    try {
      const orig = this._editOriginal;
      const newData = this._editNewData;
      const cambios = this._editCambios;
      if (!orig || !newData || !cambios || cambios.length === 0) {
        throw new Error('No hay datos de edición');
      }

      const nuevaVersion = (orig.version || 1) + 1;
      const modificadoPor = Auth.currentProfile.id;

      // 1. Insertar registros de historial (uno por campo cambiado)
      for (const c of cambios) {
        const histRecord = {
          deca_id: decaId,
          version: nuevaVersion,
          campo: c.key,
          valor_anterior: c.antes || null,
          valor_nuevo: c.despues || null,
          modificado_por: modificadoPor,
        };
        const { error: hErr } = await sbInsert('deca_historial', histRecord);
        if (hErr) {
          console.error('[DeCA] Error guardando historial campo ' + c.key + ':', hErr);
          // Continuar con los demás, no bloquear la edición
        }
      }

      // 2. Actualizar la DeCA con los nuevos valores
      const updateRecord = {
        fecha_transporte: newData.fecha_transporte,
        hora_carga: newData.hora_carga,
        origen: newData.origen,
        destino: newData.destino,
        descripcion_mercancia: newData.descripcion_mercancia,
        peso: newData.peso,
        bultos: newData.bultos,
        cargador_id: newData.cargador_id,
        nombre_cargador: newData.nombre_cargador,
        nif_cargador: newData.nif_cargador,
        direccion_cargador: newData.direccion_cargador,
        destinatario_id: newData.destinatario_id,
        nombre_destinatario: newData.nombre_destinatario,
        nif_destinatario: newData.nif_destinatario,
        direccion_destinatario: newData.direccion_destinatario,
        vehiculo_id: newData.vehiculo_id,
        matricula_vehiculo: newData.matricula_vehiculo,
        remolque_id: newData.remolque_id,
        matricula_remolque: newData.matricula_remolque,
        conductor_id: newData.conductor_id,
        nombre_conductor: newData.nombre_conductor,
        dni_conductor: newData.dni_conductor,
        version: nuevaVersion,
        estado: 'modificado',
      };

      const { error: uErr } = await sbUpdate('decas', 'id=eq.' + decaId, updateRecord);
      if (uErr) throw new Error(uErr.message);

      console.log('[DeCA] Editada OK:', orig.referencia, 'v' + nuevaVersion);

      // Limpiar datos temporales
      this._editOriginal = null;
      this._editNewData = null;
      this._editCambios = null;

      closeModal();
      showToast(`DeCA ${orig.referencia} actualizada (v${nuevaVersion})`);
      await this.loadDecas();

    } catch (err) {
      console.error('[DeCA] Error editando:', err);
      if (errorEl && errorEl.isConnected) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      } else {
        showToast('Error: ' + err.message, 'error');
      }
    } finally {
      if (btn && btn.isConnected) {
        btn.disabled = false;
        const txt = btn.querySelector('.btn-text');
        const sp = btn.querySelector('.btn-spinner');
        if (txt) txt.textContent = 'Guardar cambios';
        if (sp) sp.hidden = true;
      }
    }
  },

  // ====== CAMBIAR ESTADO (finalizar / anular) ======
  async cambiarEstado(decaId, nuevoEstado) {
    const labels = { finalizado: 'finalizar', anulado: 'anular' };
    const label = labels[nuevoEstado] || nuevoEstado;

    confirmAction(`¿Seguro que quieres ${label} esta DeCA? Esta acción no se puede deshacer.`, async () => {
      try {
        const updates = { estado: nuevoEstado };
        if (nuevoEstado === 'finalizado') {
          updates.fecha_fin_servicio = new Date().toISOString();
        }

        const { error } = await sbUpdate('decas', 'id=eq.' + decaId, updates);

        if (error) throw new Error(error.message);

        showToast(`DeCA ${nuevoEstado === 'finalizado' ? 'finalizada' : 'anulada'}`);
        closeModal();
        await this.loadDecas();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  },

  async _generarPDFConDatos(d) {
    try {
      // Verificar que jsPDF esta disponible
      if (typeof window.jspdf === 'undefined') {
        showToast('Cargando generador de PDF...', 'info');
        await new Promise(r => setTimeout(r, 1000));
        if (typeof window.jspdf === 'undefined') {
          showToast('Error: jsPDF no disponible', 'error');
          return;
        }
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');
      const pw = 210; // page width
      const m = 14;   // margin
      const cw = pw - m * 2; // content width
      let y = 0;

      // Colores
      const PRIMARY = [26, 86, 219];
      const DARK = [30, 30, 30];
      const GRAY = [120, 120, 120];
      const LIGHT_BG = [245, 247, 252];
      const WHITE = [255, 255, 255];

      // ========== CABECERA — banda de color ==========
      doc.setFillColor(...PRIMARY);
      doc.rect(0, 0, pw, 28, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('DOCUMENTO DE CONTROL', pw / 2, 12, { align: 'center' });
      doc.setFontSize(11);
      doc.text('Documento Electronico de Control Administrativo (DeCA)', pw / 2, 19, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Conforme a la Orden TRM/282/2026', pw / 2, 25, { align: 'center' });

      y = 33;

      // ========== BLOQUE EMPRESA TRANSPORTISTA ==========
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(m, y, cw, 22, 2, 2, 'F');
      doc.setTextColor(...DARK);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(this.EMPRESA.nombre, m + 4, y + 7);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.text(`NIF: ${this.EMPRESA.nif}`, m + 4, y + 13);
      doc.text(this.EMPRESA.direccion, m + 4, y + 18);
      // Referencia y version a la derecha
      doc.setTextColor(...DARK);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Ref: ${d.referencia || '--'}`, pw - m - 4, y + 7, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.text(`Version: ${d.version || 1}`, pw - m - 4, y + 13, { align: 'right' });
      if (this.EMPRESA.num_autorizacion) {
        doc.text(`Aut: ${this.EMPRESA.num_autorizacion}`, pw - m - 4, y + 18, { align: 'right' });
      }

      y += 27;

      // ========== HELPERS ==========
      const sectionTitle = (title) => {
        doc.setFillColor(...PRIMARY);
        doc.rect(m, y, cw, 7, 'F');
        doc.setTextColor(...WHITE);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(title, m + 3, y + 5);
        doc.setTextColor(...DARK);
        doc.setFont('helvetica', 'normal');
        y += 10;
      };

      const row = (label, value, x, w) => {
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        doc.text(label, x, y);
        doc.setFontSize(9.5);
        doc.setTextColor(...DARK);
        doc.setFont('helvetica', 'bold');
        doc.text(String(value || '--'), x, y + 4.5, { maxWidth: w || 75 });
        doc.setFont('helvetica', 'normal');
      };

      const col1 = m + 3;
      const col2 = m + cw / 2 + 2;
      const halfW = cw / 2 - 6;

      const fecha = d.fecha_transporte
        ? new Date(d.fecha_transporte).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
        : '--';

      // ========== SECCION: PARTES INTERVINIENTES ==========
      sectionTitle('PARTES INTERVINIENTES');

      // Cargador contractual / Expedidor
      doc.setFontSize(8);
      doc.setTextColor(...PRIMARY);
      doc.setFont('helvetica', 'bold');
      doc.text('Cargador contractual / Expedidor', col1, y);
      doc.setFont('helvetica', 'normal');
      y += 4;
      row('Nombre / Razon social', d.nombre_cargador, col1, halfW);
      row('NIF', d.nif_cargador, col2, halfW);
      y += 8;
      row('Direccion', d.direccion_cargador, col1, cw - 6);
      y += 10;

      // Destinatario
      doc.setFontSize(8);
      doc.setTextColor(...PRIMARY);
      doc.setFont('helvetica', 'bold');
      doc.text('Destinatario', col1, y);
      doc.setFont('helvetica', 'normal');
      y += 4;
      row('Nombre / Razon social', d.nombre_destinatario, col1, halfW);
      row('NIF', d.nif_destinatario, col2, halfW);
      y += 8;
      row('Direccion', d.direccion_destinatario, col1, cw - 6);
      y += 10;

      // Transportista efectivo
      doc.setFontSize(8);
      doc.setTextColor(...PRIMARY);
      doc.setFont('helvetica', 'bold');
      doc.text('Transportista efectivo', col1, y);
      doc.setFont('helvetica', 'normal');
      y += 4;
      row('Nombre / Razon social', d.empresa, col1, halfW);
      row('NIF', d.nif_empresa, col2, halfW);
      y += 8;
      row('Direccion', this.EMPRESA.direccion, col1, halfW);
      row('N. autorizacion', d.num_autorizacion || '--', col2, halfW);
      y += 12;

      // ========== SECCION: ENVIO ==========
      sectionTitle('ENVIO');

      row('Lugar de carga', d.origen, col1, halfW);
      row('Lugar de descarga', d.destino, col2, halfW);
      y += 8;
      row('Fecha de transporte', fecha, col1, halfW);
      row('Hora de carga', d.hora_carga || '--', col2, halfW);
      y += 8;
      row('Naturaleza de la mercancia', d.descripcion_mercancia, col1, cw - 6);
      y += 8;
      row('Peso (kg)', d.peso ? Number(d.peso).toLocaleString('es-ES') + ' kg' : '--', col1, halfW);
      row('Bultos', d.bultos || '--', col2, halfW);
      y += 8;
      row('N. expedicion', d.num_expedicion || d.referencia || '--', col1, halfW);
      y += 12;

      // ========== SECCION: VEHICULO ==========
      sectionTitle('VEHICULO');

      row('Matricula vehiculo', d.matricula_vehiculo, col1, halfW);
      row('Matricula remolque', d.matricula_remolque || 'N/A', col2, halfW);
      y += 8;
      row('Conductor', d.nombre_conductor, col1, halfW);
      row('DNI / NIE', d.dni_conductor, col2, halfW);
      y += 14;

      // ========== CODIGO QR ==========
      const qrUrl = d.qr_code || `https://deca-manager.netlify.app/deca.html?ref=${d.referencia}`;
      if (typeof QRious !== 'undefined') {
        try {
          const qr = new QRious({ value: qrUrl, size: 400, level: 'M' });
          const qrData = qr.toDataURL('image/png');
          const qrSize = 30;
          const qrX = pw / 2 - qrSize / 2;
          doc.addImage(qrData, 'PNG', qrX, y, qrSize, qrSize);
          doc.setFontSize(7);
          doc.setTextColor(...GRAY);
          doc.text('Escanear para verificar y descargar el documento', pw / 2, y + qrSize + 4, { align: 'center' });
          doc.text(qrUrl, pw / 2, y + qrSize + 8, { align: 'center' });
        } catch (qrErr) {
          console.warn('Error generando QR:', qrErr);
        }
      }

      // ========== DATOS CORREGIDOS (si version > 1) ==========
      if (d.version && d.version > 1) {
        try {
          const { data: historial } = await sbSelect('deca_historial',
            `select=*&deca_id=eq.${d.id}&order=version.asc,created_at.asc`);
          const registros = historial || [];

          if (registros.length > 0) {
            const campoLabel = {
              nombre_cargador: 'Cargador', nif_cargador: 'NIF Cargador',
              direccion_cargador: 'Dir. Cargador', nombre_destinatario: 'Destinatario',
              nif_destinatario: 'NIF Destinatario', direccion_destinatario: 'Dir. Destinatario',
              fecha_transporte: 'Fecha transporte', hora_carga: 'Hora carga',
              origen: 'Lugar de carga', destino: 'Lugar de descarga',
              descripcion_mercancia: 'Mercancia', peso: 'Peso (kg)', bultos: 'Bultos',
              nombre_conductor: 'Conductor', dni_conductor: 'DNI Conductor',
              matricula_vehiculo: 'Vehiculo', matricula_remolque: 'Remolque',
            };

            y += 46; // Después del QR

            if (y > 240) { doc.addPage(); y = 20; }

            // Título sección naranja
            doc.setFillColor(220, 120, 20);
            doc.rect(m, y, cw, 7, 'F');
            doc.setTextColor(...WHITE);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('DATOS CORREGIDOS', m + 3, y + 5);
            y += 10;

            // Cabecera tabla
            doc.setFillColor(245, 245, 245);
            doc.rect(m, y - 1, cw, 6, 'F');
            doc.setTextColor(...DARK);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('V.', m + 2, y + 3);
            doc.text('Campo', m + 12, y + 3);
            doc.text('Valor anterior', m + 55, y + 3);
            doc.text('Valor nuevo', m + 120, y + 3);
            doc.setFont('helvetica', 'normal');
            y += 7;

            for (const h of registros) {
              if (h.campo && h.campo.endsWith('_id')) continue;
              if (y > 272) { doc.addPage(); y = 20; }

              doc.setDrawColor(230, 230, 230);
              doc.line(m, y - 1, pw - m, y - 1);
              doc.setFontSize(7);
              doc.setTextColor(...DARK);
              doc.text(String(h.version), m + 2, y + 3);
              doc.text(campoLabel[h.campo] || h.campo, m + 12, y + 3);
              doc.setTextColor(180, 60, 60);
              doc.text(String(h.valor_anterior || '(vacio)'), m + 55, y + 3, { maxWidth: 60 });
              doc.setTextColor(20, 130, 80);
              doc.text(String(h.valor_nuevo || '(vacio)'), m + 120, y + 3, { maxWidth: 60 });
              y += 6;
            }
          }
        } catch (histErr) {
          console.warn('Error cargando historial para PDF:', histErr);
        }
      }

      // ========== PIE DE PAGINA ==========
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        const footerY = 282;
        doc.setDrawColor(200, 200, 200);
        doc.line(m, footerY, pw - m, footerY);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generado por DeCA Manager -- ${new Date().toLocaleString('es-ES')}`, m, footerY + 4);
        doc.text(`Ref: ${d.referencia} | Pag. ${p}/${totalPages} | Conforme a Orden TRM/282/2026`, pw - m, footerY + 4, { align: 'right' });
      }

      // ========== DESCARGAR ==========
      doc.save(`${d.referencia || 'DeCA'}.pdf`);
      showToast('PDF generado correctamente');

    } catch (err) {
      console.error('Error generando PDF:', err);
      showToast('Error generando PDF', 'error');
    }
  },
};
