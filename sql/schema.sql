-- ============================================================
-- DeCA Manager — Esquema completo para Supabase
-- Ejecutar en SQL Editor de Supabase (en orden)
-- ============================================================

-- 1. PROFILES (enlazada con Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  dni TEXT,
  email TEXT,
  telefono TEXT,
  rol TEXT NOT NULL DEFAULT 'conductor' CHECK (rol IN ('admin', 'conductor')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. VEHICULOS (camiones y plataformas)
CREATE TABLE vehiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL DEFAULT 'camion' CHECK (tipo IN ('camion', 'plataforma')),
  marca TEXT,
  modelo TEXT,
  mma NUMERIC,
  num_ejes INTEGER,
  tara NUMERIC,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. REMOLQUES
CREATE TABLE remolques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL DEFAULT 'lona' CHECK (tipo IN ('lona', 'frigorifico', 'cisterna', 'portacontenedores', 'basculante', 'otro')),
  marca TEXT,
  modelo TEXT,
  num_ejes INTEGER,
  tara NUMERIC,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PLANTILLAS DE RUTA (solo admin las crea, conductores las usan)
CREATE TABLE plantillas_ruta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  cliente TEXT,
  origen TEXT,
  destino TEXT,
  descripcion_mercancia TEXT,
  peso NUMERIC,
  bultos INTEGER,
  vehiculo_id UUID REFERENCES vehiculos(id),
  remolque_id UUID REFERENCES remolques(id),
  notas TEXT,
  creada_por UUID REFERENCES profiles(id),
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. DECAS
CREATE TABLE decas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'modificado', 'sustituido', 'finalizado')),
  fecha_transporte DATE NOT NULL,
  num_expedicion TEXT,
  origen TEXT NOT NULL,
  destino TEXT NOT NULL,
  descripcion_mercancia TEXT NOT NULL,
  peso NUMERIC,
  bultos INTEGER,
  vehiculo_id UUID REFERENCES vehiculos(id),
  remolque_id UUID REFERENCES remolques(id),
  matricula_vehiculo TEXT,
  matricula_remolque TEXT,
  empresa TEXT,
  nif_empresa TEXT,
  num_autorizacion TEXT,
  conductor_id UUID REFERENCES profiles(id),
  nombre_conductor TEXT,
  dni_conductor TEXT,
  pdf_url TEXT,
  qr_code TEXT,
  plantilla_id UUID REFERENCES plantillas_ruta(id),
  creado_por UUID REFERENCES profiles(id),
  entregado_conductor BOOLEAN DEFAULT false,
  fecha_entrega TIMESTAMPTZ,
  fecha_fin_servicio TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. HISTORIAL DE CAMBIOS (auditoría)
CREATE TABLE deca_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deca_id UUID NOT NULL REFERENCES decas(id) ON DELETE CASCADE,
  version_anterior INTEGER NOT NULL,
  version_nueva INTEGER NOT NULL,
  campo_modificado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  motivo_cambio TEXT,
  pdf_url_anterior TEXT,
  usuario_cambio UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ÍNDICES
CREATE INDEX idx_decas_conductor ON decas(conductor_id);
CREATE INDEX idx_decas_estado ON decas(estado);
CREATE INDEX idx_decas_fecha ON decas(fecha_transporte);
CREATE INDEX idx_decas_referencia ON decas(referencia);
CREATE INDEX idx_historial_deca ON deca_historial(deca_id);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_rol ON profiles(rol);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE remolques ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_ruta ENABLE ROW LEVEL SECURITY;
ALTER TABLE decas ENABLE ROW LEVEL SECURITY;
ALTER TABLE deca_historial ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND rol = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "Admin ve todos los perfiles" ON profiles FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Conductor ve su propio perfil" ON profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin gestiona perfiles" ON profiles FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- VEHICULOS
CREATE POLICY "Todos ven vehículos" ON vehiculos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gestiona vehículos" ON vehiculos FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- REMOLQUES
CREATE POLICY "Todos ven remolques" ON remolques FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gestiona remolques" ON remolques FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- PLANTILLAS
CREATE POLICY "Todos ven plantillas" ON plantillas_ruta FOR SELECT TO authenticated USING (activa = true OR is_admin());
CREATE POLICY "Admin gestiona plantillas" ON plantillas_ruta FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- DECAS
CREATE POLICY "Admin ve todas las DeCA" ON decas FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Conductor ve sus DeCA" ON decas FOR SELECT TO authenticated USING (conductor_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin gestiona todas las DeCA" ON decas FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Conductor crea sus DeCA" ON decas FOR INSERT TO authenticated WITH CHECK (conductor_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Conductor modifica sus DeCA" ON decas FOR UPDATE TO authenticated USING (conductor_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- HISTORIAL
CREATE POLICY "Admin ve todo el historial" ON deca_historial FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Conductor ve historial de sus DeCA" ON deca_historial FOR SELECT TO authenticated USING (deca_id IN (SELECT id FROM decas WHERE conductor_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));
CREATE POLICY "Usuarios autenticados insertan historial" ON deca_historial FOR INSERT TO authenticated WITH CHECK (true);

-- FUNCIÓN: auto-generar referencia DeCA
CREATE OR REPLACE FUNCTION generar_referencia_deca()
RETURNS TRIGGER AS $$
DECLARE
  anio TEXT;
  seq INTEGER;
BEGIN
  anio := EXTRACT(YEAR FROM NOW())::TEXT;
  SELECT COALESCE(MAX(CAST(SPLIT_PART(referencia, '-', 3) AS INTEGER)), 0) + 1
  INTO seq FROM decas WHERE referencia LIKE 'DeCA-' || anio || '-%';
  NEW.referencia := 'DeCA-' || anio || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_referencia_deca BEFORE INSERT ON decas FOR EACH ROW
  WHEN (NEW.referencia IS NULL OR NEW.referencia = '') EXECUTE FUNCTION generar_referencia_deca();

-- FUNCIÓN: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vehiculos_updated_at BEFORE UPDATE ON vehiculos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_remolques_updated_at BEFORE UPDATE ON remolques FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_plantillas_updated_at BEFORE UPDATE ON plantillas_ruta FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_decas_updated_at BEFORE UPDATE ON decas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
