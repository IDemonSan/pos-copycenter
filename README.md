# POS CopyCenter - Cloud Database Schema (Supabase / PostgreSQL)

Este repositorio contiene el sistema de base de datos para la aplicación **POS CopyCenter**. 
Para habilitar la sincronización en la nube y el respaldo dinámico, el backend está soportado sobre **Supabase** (PostgreSQL).

A continuación se detalla el esquema consolidado en sintaxis pura de **PostgreSQL** para ser ejecutado en el **SQL Editor** del panel de Supabase.

---

## Esquema SQL para Supabase

Copia y pega el siguiente bloque SQL en el **SQL Editor** de tu proyecto en Supabase para crear las tablas necesarias:

```sql
-- =========================================================================
-- ESQUEMA DE BASE DE DATOS - POS COPYCENTER (POSTGRESQL - SUPABASE)
-- =========================================================================

-- 1. Tabla de Productos
CREATE TABLE IF NOT EXISTS productos (
    id VARCHAR(36) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio_cents INTEGER NOT NULL,
    is_variable INTEGER DEFAULT 0, -- 1 = precio variable, 0 = precio fijo
    is_custom INTEGER DEFAULT 0,   -- 1 = caso especial, 0 = normal
    orden_prioridad INTEGER DEFAULT 0,
    activo INTEGER DEFAULT 1,      -- 1 = visible en POS, 0 = oculto
    is_synced INTEGER DEFAULT 0,   -- 1 = sincronizado, 0 = pendiente
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL
);

-- 2. Tabla de Ventas (Cabeceras)
CREATE TABLE IF NOT EXISTS ventas (
    id VARCHAR(36) PRIMARY KEY,
    fecha_venta DATE NOT NULL,     -- Fecha de consumo (sin hora local)
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL, -- Creación real
    turno VARCHAR(20) NOT NULL,    -- 'Mañana' o 'Tarde'
    aula VARCHAR(50) NOT NULL,     -- Grado y sección
    total_cents INTEGER NOT NULL,
    estado_pago INTEGER DEFAULT 0, -- 0 = Pendiente, 1 = Pagado
    anulado_at TIMESTAMP WITH TIME ZONE,
    motivo_anulacion TEXT,
    is_synced INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL
);

-- Índices de Ventas para Optimización de Reportes
CREATE INDEX IF NOT EXISTS idx_ventas_reportes ON ventas(estado_pago, anulado_at, fecha_venta, aula);

-- 3. Tabla de Detalle de Ventas
CREATE TABLE IF NOT EXISTS detalle_ventas (
    id VARCHAR(36) PRIMARY KEY,
    venta_id VARCHAR(36) NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id VARCHAR(36),       -- Null si el producto fue eliminado o es custom
    producto_nombre VARCHAR(100) NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario_cents INTEGER NOT NULL,
    subtotal_cents INTEGER NOT NULL,
    
    -- Multiplicadores / Desglose del POS (Ej. 37 alumnos x 5 copias = 185 unidades)
    detalle_multiplicador VARCHAR(100), -- Texto descriptivo: "37x5"
    multiplicador_paquetes INTEGER,     -- Componente de alumnos/paquetes (Ej: 37)
    multiplicador_hojas INTEGER         -- Componente de hojas por paquete (Ej: 5)
);

-- Índice para búsquedas rápidas por Venta ID
CREATE INDEX IF NOT EXISTS idx_detalle_venta_id ON detalle_ventas(venta_id);

-- 4. Tabla de Medios de Pago (QR)
CREATE TABLE IF NOT EXISTS medios_pago (
    id SERIAL PRIMARY KEY,
    banco_nombre VARCHAR(50) NOT NULL, -- 'Yape', 'Plin', 'BCP', etc.
    qr_image_path TEXT NOT NULL,       -- Ruta local del dispositivo
    descripcion TEXT                   -- Titular o número de cuenta
);

-- =========================================================================
-- SEGURIDAD DE TABLAS (POLÍTICAS RLS)
-- =========================================================================

-- Habilitar RLS en las tablas del negocio para impedir accesos anónimos
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_ventas ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso para que solo los usuarios autenticados (authenticated)
-- puedan realizar cualquier operación (Lectura, Inserción, Actualización, Eliminación)
CREATE POLICY "Permitir todo a usuarios autenticados" ON productos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo a usuarios autenticados" ON ventas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo a usuarios autenticados" ON detalle_ventas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
```
---

## Explicación de las Tablas y Tipos de Datos

* **`productos`**: Almacena el catálogo. El campo `is_custom` permite identificar los "Casos Especiales" cuyos nombres y precios se ingresan directamente en la venta. El orden de prioridad maneja la cuadrícula del POS.
* **`ventas`**: Registra la transacción principal asociada a un aula y turno. El tipo `DATE` en `fecha_venta` previene corrimientos de fecha por desfases horarias (mantiene el día local del dispositivo).
* **`detalle_ventas`**: Líneas de consumo asociadas a cada venta.
  * `detalle_multiplicador` almacena en texto el formato del desglose `"37x5"`.
  * Se incluyeron las columnas nativas opcionales `multiplicador_paquetes` (ej: 37 alumnos) y `multiplicador_hojas` (ej: 5 hojas) en formato `INTEGER` para facilitar futuras consultas analíticas en la nube.
* **`medios_pago`**: Almacena los métodos de cobro configurados. En PostgreSQL, el identificador utiliza un `SERIAL` (autoincremental automático), mapeando el comportamiento del `AUTOINCREMENT` de SQLite.

---

## Cómo Ejecutar este Script

1. Entra a tu panel de control de **[Supabase](https://supabase.com/)** y selecciona tu proyecto **POS-CopyCenter**.
2. En la barra lateral izquierda, haz clic en **SQL Editor**.
3. Presiona el botón **New Query** (+).
4. Pega todo el código SQL provisto arriba en la caja de texto.
5. Haz clic en el botón **Run** (Ejecutar) en la esquina inferior derecha.
6. ¡Listo! Las tablas e índices se habrán creado correctamente en la nube y estarán listas para recibir datos sincronizados desde la aplicación móvil.
