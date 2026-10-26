# DeCA Manager — Guía de despliegue (Chunk 1)

## 1. Supabase

### 1.1 Crear proyecto
- Ve a https://supabase.com → New Project
- Anota la **URL** y la **anon key** (Settings → API)

### 1.2 Ejecutar esquema SQL
- Ve a SQL Editor en Supabase
- Copia y pega el contenido de `sql/schema.sql`
- Ejecuta todo

### 1.3 Configurar la app
- Abre `js/supabase-config.js`
- Reemplaza `SUPABASE_URL` y `SUPABASE_ANON_KEY` con tus valores

### 1.4 Crear los primeros usuarios admin
En el SQL Editor de Supabase, después de crear un usuario manualmente en Authentication → Users:

```sql
-- Después de crear el usuario en Auth, inserta su perfil:
INSERT INTO profiles (user_id, nombre, apellidos, email, dni, rol)
VALUES (
  'UUID-DEL-USUARIO-EN-AUTH',
  'Alberto',
  'Grande',
  'tu@email.com',
  'TU-DNI',
  'admin'
);
```

O usa el Dashboard: Authentication → Users → Add User, y luego inserta el perfil con el SQL de arriba.

### 1.5 Desplegar Edge Function
```bash
# Instalar Supabase CLI si no lo tienes
npm install -g supabase

# Login
supabase login

# Vincular proyecto
supabase link --project-ref TU-PROJECT-REF

# Desplegar la función
supabase functions deploy create-user

# Configurar el secret (la service_role key está en Settings → API)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

## 2. Netlify

### 2.1 Desplegar
- Sube la carpeta raíz del proyecto (index.html, css/, js/, etc.) a un repo de GitHub
- Ve a https://app.netlify.com → Add new site → Import from Git
- Selecciona el repo
- Build command: (dejar vacío, no hace falta build)
- Publish directory: `.` (raíz)
- Deploy

### 2.2 Dominio (opcional)
- En Netlify → Domain settings → Add custom domain

## Estructura de archivos

```
deca-manager/
├── index.html           ← App principal
├── manifest.json        ← PWA manifest
├── sw.js                ← Service Worker
├── css/
│   └── styles.css       ← Estilos
├── js/
│   ├── supabase-config.js  ← Config Supabase (editar)
│   ├── auth.js             ← Autenticación
│   ├── app.js              ← Controlador principal
│   └── usuarios.js         ← Gestión de usuarios (admin)
├── icons/
│   └── icon.svg         ← Icono PWA
├── sql/
│   └── schema.sql       ← Esquema BD completo
└── supabase/
    └── functions/
        └── create-user/
            └── index.ts ← Edge Function crear usuarios
```
