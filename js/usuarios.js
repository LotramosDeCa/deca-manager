// ============================================================
// DeCA Manager — Gestión de Usuarios (solo Admin)
// ============================================================

const Usuarios = {
  list: [],

  // Renderizar vista principal de usuarios
  async render(container) {
    if (!Auth.isAdmin()) {
      container.innerHTML = '<div class="empty-state"><p>No tienes acceso a esta sección</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="section-header">
        <h3>Usuarios</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-user">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo
        </button>
      </div>
      <div id="users-list" class="card-list">
        <div class="skeleton" style="height: 68px; margin-bottom: 8px;"></div>
        <div class="skeleton" style="height: 68px; margin-bottom: 8px;"></div>
        <div class="skeleton" style="height: 68px;"></div>
      </div>
    `;

    document.getElementById('btn-add-user').addEventListener('click', () => this.showForm());
    await this.loadUsers();
  },

  // Cargar lista de usuarios
  async loadUsers() {
    const { data, error } = await sbSelect('profiles', 'select=*&order=rol.asc,nombre.asc');

    if (error) {
      showToast('Error cargando usuarios', 'error');
      console.error(error);
      return;
    }

    this.list = data || [];
    this.renderList();
  },

  // Renderizar lista
  renderList() {
    const container = document.getElementById('users-list');
    if (!container) return;

    if (this.list.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          <p>No hay usuarios registrados</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.list.map(user => {
      const initials = (user.nombre[0] + (user.apellidos?.[0] || '')).toUpperCase();
      const isCurrentUser = user.user_id === Auth.currentUser.id;

      return `
        <div class="list-card" data-id="${user.id}">
          <div class="list-card-avatar avatar-${user.rol}">${initials}</div>
          <div class="list-card-info">
            <div class="name">${user.nombre} ${user.apellidos} ${isCurrentUser ? '<span style="color:var(--gray-400)">(tú)</span>' : ''}</div>
            <div class="detail">${user.email || 'Sin email'} · ${user.dni || 'Sin DNI'}</div>
          </div>
          <span class="badge badge-${user.activo ? 'activo' : 'inactivo'}">${user.activo ? user.rol : 'Inactivo'}</span>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.list-card').forEach(card => {
      card.addEventListener('click', () => {
        const user = this.list.find(u => u.id === card.dataset.id);
        if (user) this.showDetail(user);
      });
    });
  },

  // Mostrar detalle de un usuario
  showDetail(user) {
    const isCurrentUser = user.user_id === Auth.currentUser.id;
    const statusBadge = user.activo
      ? '<span class="badge badge-activo">Activo</span>'
      : '<span class="badge badge-inactivo">Inactivo</span>';

    showModal(`${user.nombre} ${user.apellidos}`, `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="list-card-avatar avatar-${user.rol}" style="width:56px;height:56px;font-size:20px;">
            ${(user.nombre[0] + (user.apellidos?.[0] || '')).toUpperCase()}
          </div>
          <div>
            <span class="badge badge-${user.rol}" style="margin-bottom:4px;">${user.rol}</span>
            ${statusBadge}
          </div>
        </div>
        <div style="display:grid; gap:8px;">
          <div>
            <span style="font-size:12px; color:var(--gray-500);">Email</span>
            <p style="font-size:14px; font-weight:500;">${user.email || '—'}</p>
          </div>
          <div>
            <span style="font-size:12px; color:var(--gray-500);">DNI</span>
            <p style="font-size:14px; font-weight:500;">${user.dni || '—'}</p>
          </div>
          <div>
            <span style="font-size:12px; color:var(--gray-500);">Teléfono</span>
            <p style="font-size:14px; font-weight:500;">${user.telefono || '—'}</p>
          </div>
          <div>
            <span style="font-size:12px; color:var(--gray-500);">Registrado</span>
            <p style="font-size:14px; font-weight:500;">${new Date(user.created_at).toLocaleDateString('es-ES')}</p>
          </div>
        </div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
      <button class="btn btn-primary" onclick="Usuarios.showForm('${user.id}')">Editar</button>
      ${!isCurrentUser ? `<button class="btn ${user.activo ? 'btn-danger' : 'btn-success'} btn-sm" onclick="Usuarios.toggleActive('${user.id}', ${!user.activo})">${user.activo ? 'Desactivar' : 'Activar'}</button>` : ''}
    `);
  },

  // Formulario crear/editar usuario
  showForm(userId) {
    closeModal();
    const user = userId ? this.list.find(u => u.id === userId) : null;
    const isEdit = !!user;
    const title = isEdit ? 'Editar usuario' : 'Nuevo usuario';

    const formHTML = `
      <form id="user-form" style="display:flex; flex-direction:column; gap:4px;">
        <div class="form-row">
          <div class="form-group">
            <label for="user-nombre">Nombre *</label>
            <input type="text" id="user-nombre" required value="${user?.nombre || ''}">
          </div>
          <div class="form-group">
            <label for="user-apellidos">Apellidos *</label>
            <input type="text" id="user-apellidos" required value="${user?.apellidos || ''}">
          </div>
        </div>
        <div class="form-group">
          <label for="user-email">Email *</label>
          <input type="email" id="user-email" required value="${user?.email || ''}" ${isEdit ? 'disabled' : ''}>
          ${isEdit ? '<p style="font-size:11px; color:var(--gray-400); margin-top:2px;">El email no se puede cambiar</p>' : ''}
        </div>
        ${!isEdit ? `
        <div class="form-group">
          <label for="user-password">Contraseña *</label>
          <input type="password" id="user-password" required minlength="6" placeholder="Mínimo 6 caracteres">
        </div>
        ` : ''}
        <div class="form-row">
          <div class="form-group">
            <label for="user-dni">DNI</label>
            <input type="text" id="user-dni" value="${user?.dni || ''}" placeholder="12345678A">
          </div>
          <div class="form-group">
            <label for="user-telefono">Teléfono</label>
            <input type="tel" id="user-telefono" value="${user?.telefono || ''}" placeholder="600123456">
          </div>
        </div>
        <div class="form-group">
          <label for="user-rol">Rol *</label>
          <select id="user-rol">
            <option value="conductor" ${(!user || user.rol === 'conductor') ? 'selected' : ''}>Conductor</option>
            <option value="admin" ${user?.rol === 'admin' ? 'selected' : ''}>Administrador</option>
          </select>
        </div>
        <div id="user-form-error" class="error-msg" hidden></div>
      </form>
    `;

    showModal(title, formHTML, `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="user-form-submit">
        <span class="btn-text">${isEdit ? 'Guardar cambios' : 'Crear usuario'}</span>
        <span class="btn-spinner" hidden></span>
      </button>
    `);

    document.getElementById('user-form-submit').addEventListener('click', () => {
      if (isEdit) {
        this.updateUser(user.id);
      } else {
        this.createUser();
      }
    });
  },

  // Crear nuevo usuario (via Supabase Edge Function o Admin API)
  async createUser() {
    const form = document.getElementById('user-form');
    if (!form.reportValidity()) return;

    const btn = document.getElementById('user-form-submit');
    const errorEl = document.getElementById('user-form-error');
    errorEl.hidden = true;

    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;
    const nombre = document.getElementById('user-nombre').value.trim();
    const apellidos = document.getElementById('user-apellidos').value.trim();
    const dni = document.getElementById('user-dni').value.trim();
    const telefono = document.getElementById('user-telefono').value.trim();
    const rol = document.getElementById('user-rol').value;

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Creando...';
    btn.querySelector('.btn-spinner').hidden = false;

    try {
      // Llamar a la Edge Function via fetch directo (el SDK da problemas con Tracking Prevention)
      const res = await fetch(SUPABASE_URL + '/functions/v1/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SB_TOKEN,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ email, password, nombre, apellidos, dni, telefono, rol })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error creando usuario');

      closeModal();
      showToast(`${nombre} ${apellidos} creado correctamente`);
      await this.loadUsers();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Crear usuario';
      btn.querySelector('.btn-spinner').hidden = true;
    }
  },

  // Actualizar perfil existente
  async updateUser(userId) {
    const form = document.getElementById('user-form');
    if (!form.reportValidity()) return;

    const btn = document.getElementById('user-form-submit');
    const errorEl = document.getElementById('user-form-error');
    errorEl.hidden = true;

    const updates = {
      nombre: document.getElementById('user-nombre').value.trim(),
      apellidos: document.getElementById('user-apellidos').value.trim(),
      dni: document.getElementById('user-dni').value.trim() || null,
      telefono: document.getElementById('user-telefono').value.trim() || null,
      rol: document.getElementById('user-rol').value,
    };

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Guardando...';
    btn.querySelector('.btn-spinner').hidden = false;

    try {
      const { error } = await sbUpdate('profiles', 'id=eq.' + userId, updates);

      if (error) throw new Error(error.message);

      // Si el usuario editado es el actual, recargar su perfil
      const editedUser = this.list.find(u => u.id === userId);
      if (editedUser?.user_id === Auth.currentUser.id) {
        await Auth.loadProfile(Auth.currentUser);
        App.updateHeader();
      }

      closeModal();
      showToast('Usuario actualizado');
      await this.loadUsers();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Guardar cambios';
      btn.querySelector('.btn-spinner').hidden = true;
    }
  },

  // Activar/desactivar usuario
  async toggleActive(userId, newState) {
    closeModal();

    const user = this.list.find(u => u.id === userId);
    const action = newState ? 'activar' : 'desactivar';

    confirmAction(
      `¿Seguro que quieres ${action} a ${user.nombre} ${user.apellidos}?`,
      async () => {
        const { error } = await sbUpdate('profiles', 'id=eq.' + userId, { activo: newState });

        if (error) {
          showToast(`Error al ${action} usuario`, 'error');
          return;
        }

        showToast(`${user.nombre} ${newState ? 'activado' : 'desactivado'}`);
        await this.loadUsers();
      }
    );
  },

  // Cambiar contraseña (via Edge Function)
  async resetPassword(userId, email) {
    confirmAction(
      `¿Enviar email de restablecimiento de contraseña a ${email}?`,
      async () => {
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email);
          if (error) throw error;
          showToast('Email de restablecimiento enviado');
        } catch (err) {
          showToast('Error enviando email', 'error');
        }
      }
    );
  }
};
