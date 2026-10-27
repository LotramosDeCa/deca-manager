// ============================================================
// DeCA Manager — Gestión de DeCA (Chunk 3)
// ============================================================

const Decas = {
  list: [],
  vehiculosActivos: [],
  remolquesActivos: [],

  // Datos de empresa (fijos para Lotramos)
  EMPRESA: {
    nombre: 'Lotramos',
    nif: '',              // Alberto rellenará su NIF
    num_autorizacion: '', // N.º autorización transporte
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
    let query = supabase
      .from('decas')
      .select('*')
      .order('created_at', { ascending: false });

    // Conductores solo ven las suyas
    if (!Auth.isAdmin()) {
      query = query.eq('conductor_id', Auth.currentProfile.id);
    }

    const { data, error } = await query;

    if (error) {
      showToast('Error cargando DeCA', 'error');
      console.error(error);
      return;
    }

    this.list = data || [];
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
        activo: 'badge-activo',
        finalizado: 'badge-success',
        modificado: 'badge-warning',
        anulado: 'badge-inactivo',
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
      activo: 'badge-activo', finalizado: 'badge-success', modificado: 'badge-warning', anulado: 'badge-inactivo',
    }[d.estado] || 'badge-info';

    showModal(d.referencia || 'DeCA', `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span class="badge ${estadoClass}">${estadoLabel}</span>
          ${d.version > 1 ? `<span class="badge badge-info">Versión ${d.version}</span>` : ''}
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Referencia</span>
            <p style="font-size:13px; font-weight:600;">${d.referencia || '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Fecha transporte</span>
            <p style="font-size:13px; font-weight:500;">${fecha}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Origen</span>
            <p style="font-size:13px; font-weight:500;">${d.origen || '—'}</p>
          </div>
          <div>
            <span style="font-size:11px; color:var(--gray-500);">Destino</span>
            <p style="font-size:13px; font-weight:500;">${d.destino || '—'}</p>
          </div>
          <div style="grid-column:1/-1;">
            <span style="font-size:11px; color:var(--gray-500);">Mercancía</span>
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

        <hr style="border:none; border-top:1px solid var(--gray-200); margin:4px 0;">

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
            <span style="font-size:11px; color:var(--gray-500);">Vehículo</span>
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
            <span style="font-size:11px; color:var(--gray-500);">NIF</span>
            <p style="font-size:13px; font-weight:500;">${d.nif_empresa || '—'}</p>
          </div>
        </div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
      ${d.estado === 'activo' ? `<button class="btn btn-primary" onclick="Decas.generarPDF('${d.id}')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        PDF
      </button>` : ''}
    `);
  },

  // ====== FORMULARIO CREAR DECA ======
  async showForm() {
    closeModal();

    // Cargar vehículos y remolques activos + conductores
    const [vehiculos, remolques, conductores] = await Promise.all([
      supabase.from('vehiculos').select('id, matricula, marca, modelo').eq('activo', true).order('matricula'),
      supabase.from('remolques').select('id, matricula, marca, modelo').eq('activo', true).order('matricula'),
      supabase.from('profiles').select('id, user_id, nombre, apellidos, dni').eq('activo', true).eq('rol', 'conductor').order('nombre'),
    ]);

    this.vehiculosActivos = vehiculos.data || [];
    this.remolquesActivos = remolques.data || [];
    const conductoresActivos = conductores.data || [];

    // Incluir admins también como posibles conductores
    const admins = await supabase.from('profiles').select('id, user_id, nombre, apellidos, dni').eq('activo', true).eq('rol', 'admin').order('nombre');
    const todosConductores = [...conductoresActivos, ...(admins.data || [])];

    const hoy = new Date().toISOString().split('T')[0];

    const formHTML = `
      <form id="deca-form" style="display:flex; flex-direction:column; gap:4px; max-height:65vh; overflow-y:auto; padding-right:4px;">

        <p style="font-size:12px; color:var(--gray-500); margin-bottom:4px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Datos del transporte</p>

        <div class="form-group">
          <label for="deca-fecha">Fecha de transporte *</label>
          <input type="date" id="deca-fecha" required value="${hoy}">
        </div>

        <div class="form-group">
          <label for="deca-expedicion">N.º expedición</label>
          <input type="text" id="deca-expedicion" placeholder="Opcional">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="deca-origen">Origen *</label>
            <input type="text" id="deca-origen" required placeholder="Ciudad o dirección">
          </div>
          <div class="form-group">
            <label for="deca-destino">Destino *</label>
            <input type="text" id="deca-destino" required placeholder="Ciudad o dirección">
          </div>
        </div>

        <div class="form-group">
          <label for="deca-mercancia">Descripción mercancía *</label>
          <input type="text" id="deca-mercancia" required placeholder="Ej: Material de construcción">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="deca-peso">Peso (kg)</label>
            <input type="number" id="deca-peso" min="0" step="0.01" placeholder="0">
          </div>
          <div class="form-group">
            <label for="deca-bultos">Bultos</label>
            <input type="number" id="deca-bultos" min="0" placeholder="0">
          </div>
        </div>

        <hr style="border:none; border-top:1px solid var(--gray-200); margin:8px 0;">
        <p style="font-size:12px; color:var(--gray-500); margin-bottom:4px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Conductor y vehículo</p>

        <div class="form-group">
          <label for="deca-conductor">Conductor *</label>
          <select id="deca-conductor" required>
            <option value="">Seleccionar conductor</option>
            ${todosConductores.map(c => `<option value="${c.id}" data-nombre="${c.nombre} ${c.apellidos}" data-dni="${c.dni || ''}">${c.nombre} ${c.apellidos}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="deca-vehiculo">Vehículo *</label>
          <select id="deca-vehiculo" required>
            <option value="">Seleccionar vehículo</option>
            ${this.vehiculosActivos.map(v => `<option value="${v.id}" data-matricula="${v.matricula}">${v.matricula}${v.marca ? ' — ' + v.marca : ''}${v.modelo ? ' ' + v.modelo : ''}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="deca-remolque">Remolque</label>
          <select id="deca-remolque">
            <option value="">Sin remolque</option>
            ${this.remolquesActivos.map(r => `<option value="${r.id}" data-matricula="${r.matricula}">${r.matricula}${r.marca ? ' — ' + r.marca : ''}${r.modelo ? ' ' + r.modelo : ''}</option>`).join('')}
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

    document.getElementById('deca-form-submit').addEventListener('click', () => this.crearDeca());
  },

  // ====== CREAR DECA ======
  async crearDeca() {
    const form = document.getElementById('deca-form');
    if (!form.reportValidity()) return;

    const btn = document.getElementById('deca-form-submit');
    const errorEl = document.getElementById('deca-form-error');
    errorEl.hidden = true;

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Creando...';
    btn.querySelector('.btn-spinner').hidden = false;

    try {
      // Obtener datos del formulario
      const conductorSelect = document.getElementById('deca-conductor');
      const vehiculoSelect = document.getElementById('deca-vehiculo');
      const remolqueSelect = document.getElementById('deca-remolque');

      const conductorOption = conductorSelect.selectedOptions[0];
      const vehiculoOption = vehiculoSelect.selectedOptions[0];
      const remolqueOption = remolqueSelect.selectedOptions[0];

      // Generar referencia única: DECA-YYYYMMDD-XXXX
      const referencia = this.generarReferencia();

      // URL pública para el QR (apunta a la app con la referencia)
      const qrUrl = `https://deca-manager.netlify.app/deca.html?ref=${referencia}`;

      const record = {
        referencia,
        version: 1,
        estado: 'activo',
        fecha_transporte: document.getElementById('deca-fecha').value,
        num_expedicion: document.getElementById('deca-expedicion').value.trim() || null,
        origen: document.getElementById('deca-origen').value.trim(),
        destino: document.getElementById('deca-destino').value.trim(),
        descripcion_mercancia: document.getElementById('deca-mercancia').value.trim(),
        peso: document.getElementById('deca-peso').value ? parseFloat(document.getElementById('deca-peso').value) : null,
        bultos: document.getElementById('deca-bultos').value ? parseInt(document.getElementById('deca-bultos').value) : null,
        vehiculo_id: vehiculoSelect.value,
        matricula_vehiculo: vehiculoOption?.dataset.matricula || '',
        remolque_id: remolqueSelect.value || null,
        matricula_remolque: remolqueOption?.dataset.matricula || null,
        conductor_id: conductorSelect.value,
        nombre_conductor: conductorOption?.dataset.nombre || '',
        dni_conductor: conductorOption?.dataset.dni || '',
        empresa: this.EMPRESA.nombre,
        nif_empresa: this.EMPRESA.nif || null,
        num_autorizacion: this.EMPRESA.num_autorizacion || null,
        qr_code: qrUrl,
        creado_por: Auth.currentProfile.id,
      };

      const { data, error } = await supabase.from('decas').insert(record).select().single();

      if (error) throw new Error(error.message);

      closeModal();
      showToast(`DeCA ${referencia} creada`);
      await this.loadDecas();

      // Preguntar si quiere generar el PDF
      setTimeout(() => {
        if (data?.id) {
          confirmAction('¿Quieres generar el PDF de esta DeCA?', () => this.generarPDF(data.id));
        }
      }, 500);

    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Crear DeCA';
      btn.querySelector('.btn-spinner').hidden = true;
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
      const { data } = await supabase.from('decas').select('*').eq('id', decaId).single();
      if (!data) { showToast('DeCA no encontrada', 'error'); return; }
      this._generarPDFConDatos(data);
      return;
    }
    this._generarPDFConDatos(deca);
  },

  async _generarPDFConDatos(d) {
    try {
      // Verificar que jsPDF está disponible
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
      const pageWidth = 210;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let y = 15;

      // ---- CABECERA ----
      doc.setFillColor(26, 86, 219); // primary color
      doc.rect(0, 0, pageWidth, 32, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('DOCUMENTO ELECTRÓNICO DE CONTROL', pageWidth / 2, 14, { align: 'center' });
      doc.text('ADMINISTRATIVO (DeCA)', pageWidth / 2, 22, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Ref: ${d.referencia || '—'}  |  Versión: ${d.version || 1}`, pageWidth / 2, 29, { align: 'center' });

      y = 40;
      doc.setTextColor(0, 0, 0);

      // ---- CÓDIGO QR ----
      const qrUrl = d.qr_code || `https://deca-manager.netlify.app/deca.html?ref=${d.referencia}`;
      if (typeof QRious !== 'undefined') {
        try {
          const qr = new QRious({ value: qrUrl, size: 300, level: 'M' });
          const qrData = qr.toDataURL('image/png');
          const qrSize = 40;
          doc.addImage(qrData, 'PNG', pageWidth - margin - qrSize, y, qrSize, qrSize);

          doc.setFontSize(7);
          doc.setTextColor(120, 120, 120);
          doc.text('Escanear para verificar', pageWidth - margin - qrSize / 2, y + qrSize + 4, { align: 'center' });
          doc.setTextColor(0, 0, 0);
        } catch (qrErr) {
          console.warn('Error generando QR:', qrErr);
        }
      } else {
        console.warn('QRious library not loaded');
      }

      // ---- DATOS DEL TRANSPORTE ----
      const sectionTitle = (title, posY) => {
        doc.setFillColor(240, 244, 255);
        doc.rect(margin, posY - 4, contentWidth, 7, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 86, 219);
        doc.text(title, margin + 2, posY);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        return posY + 10;
      };

      const field = (label, value, posY, x, maxW) => {
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(label, x, posY);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(String(value || '—'), x, posY + 5, { maxWidth: maxW || 80 });
        return posY + 12;
      };

      // Sección: Datos del transporte
      y = sectionTitle('DATOS DEL TRANSPORTE', y);
      const col1 = margin + 2;
      const col2 = margin + contentWidth / 2;

      const fecha = d.fecha_transporte
        ? new Date(d.fecha_transporte).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

      field('Fecha de transporte', fecha, y, col1);
      field('N.º expedición', d.num_expedicion, y, col2);
      y += 12;

      field('Origen', d.origen, y, col1);
      field('Destino', d.destino, y, col2);
      y += 12;

      field('Descripción mercancía', d.descripcion_mercancia, y, col1, contentWidth - 4);
      y += 12;

      field('Peso (kg)', d.peso ? Number(d.peso).toLocaleString('es-ES') + ' kg' : '—', y, col1);
      field('Bultos', d.bultos, y, col2);
      y += 16;

      // Sección: Transportista
      y = sectionTitle('DATOS DEL TRANSPORTISTA', y);
      field('Empresa', d.empresa, y, col1);
      field('NIF', d.nif_empresa, y, col2);
      y += 12;
      field('N.º autorización', d.num_autorizacion, y, col1);
      y += 16;

      // Sección: Conductor
      y = sectionTitle('DATOS DEL CONDUCTOR', y);
      field('Nombre', d.nombre_conductor, y, col1);
      field('DNI', d.dni_conductor, y, col2);
      y += 16;

      // Sección: Vehículo
      y = sectionTitle('VEHÍCULO Y REMOLQUE', y);
      field('Matrícula vehículo', d.matricula_vehiculo, y, col1);
      field('Matrícula remolque', d.matricula_remolque || 'N/A', y, col2);
      y += 16;

      // ---- PIE DE PÁGINA ----
      const footerY = 280;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, footerY, pageWidth - margin, footerY);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generado por DeCA Manager — ${new Date().toLocaleString('es-ES')}`, margin, footerY + 4);
      doc.text(`Ref: ${d.referencia} | Conforme a Orden TRM/282/2026`, pageWidth - margin, footerY + 4, { align: 'right' });

      // ---- DESCARGAR ----
      doc.save(`${d.referencia || 'DeCA'}.pdf`);
      showToast('PDF generado correctamente');

    } catch (err) {
      console.error('Error generando PDF:', err);
      showToast('Error generando PDF', 'error');
    }
  },
};
