-- ============================================================
-- DeCA Manager — Tabla CLIENTES + Columnas nuevas en DECAS
-- Ejecutar en Supabase SQL Editor (todo de una vez)
-- ============================================================

-- ============================================================
-- 1. TABLA CLIENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT NOT NULL,
  nif         TEXT,
  direccion   TEXT,
  poblacion   TEXT,
  codigo_postal TEXT,
  provincia   TEXT,
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes (nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes (activo);

-- RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Lectura: usuarios autenticados
CREATE POLICY "clientes_select" ON clientes
  FOR SELECT TO authenticated USING (true);

-- Insertar: solo admin (comprueba rol en profiles)
CREATE POLICY "clientes_insert" ON clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.rol = 'admin')
  );

-- Actualizar: solo admin
CREATE POLICY "clientes_update" ON clientes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.rol = 'admin')
  );

-- GRANTs
GRANT SELECT, INSERT, UPDATE ON clientes TO authenticated;
GRANT SELECT ON clientes TO anon;

-- ============================================================
-- 2. COLUMNAS NUEVAS EN DECAS
-- ============================================================

-- Cargador (datos desnormalizados para el PDF)
ALTER TABLE decas ADD COLUMN IF NOT EXISTS cargador_id UUID REFERENCES clientes(id);
ALTER TABLE decas ADD COLUMN IF NOT EXISTS nombre_cargador TEXT;
ALTER TABLE decas ADD COLUMN IF NOT EXISTS nif_cargador TEXT;
ALTER TABLE decas ADD COLUMN IF NOT EXISTS direccion_cargador TEXT;

-- Destinatario (datos desnormalizados para el PDF)
ALTER TABLE decas ADD COLUMN IF NOT EXISTS destinatario_id UUID REFERENCES clientes(id);
ALTER TABLE decas ADD COLUMN IF NOT EXISTS nombre_destinatario TEXT;
ALTER TABLE decas ADD COLUMN IF NOT EXISTS nif_destinatario TEXT;
ALTER TABLE decas ADD COLUMN IF NOT EXISTS direccion_destinatario TEXT;

-- Hora de carga (separada de la fecha)
ALTER TABLE decas ADD COLUMN IF NOT EXISTS hora_carga TEXT;

-- Lugar de carga y descarga (renombrar origen/destino conceptualmente,
-- pero mantenemos las columnas origen y destino que ya existen y funcionan)
-- origen = lugar de carga, destino = lugar de descarga — sin tocar

-- ============================================================
-- 3. FIX PENDIENTE: CHECK constraint de estado con 'anulado'
-- ============================================================
ALTER TABLE decas DROP CONSTRAINT IF EXISTS decas_estado_check;
ALTER TABLE decas ADD CONSTRAINT decas_estado_check
  CHECK (estado IN ('activo', 'modificado', 'sustituido', 'finalizado', 'anulado'));

-- ============================================================
-- 4. TRIGGER updated_at para clientes
-- ============================================================
CREATE OR REPLACE FUNCTION update_clientes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clientes_updated_at ON clientes;
CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_clientes_updated_at();
