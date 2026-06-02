# Especificación Técnica y Arquitectura de Software v3.0
**Proyecto:** Aplicación Móvil de Control de Copias e Impresiones (Local-First)
**Arquitectura:** React Native + Expo | SQLite (Local) | Supabase (Cloud Sync)
**Enfoque:** Offline-First, UX de Alta Velocidad, Integridad Financiera, Auditoría
**Última revisión:** Junio 2025 — Incorpora revisión de arquitecto senior (correcciones críticas + mejoras UX)
**Dispositivos objetivo:** Android (teléfono principal) + Android (tablet, planificado)

---

## 0. Glosario Rápido

Este documento asume que cualquier agente de desarrollo (humano o IA) lo lee sin contexto previo. Se definen aquí los términos clave del negocio:

| Término | Definición |
|---|---|
| **Aula** | Salón escolar identificado por grado y sección (ej. "3° A"). Cada aula tiene un profesor delegado que acumula deuda mensual. |
| **Turno** | Mañana o Tarde. El mismo grado puede tener dos turnos con profesores distintos. |
| **Tiraje / Pedido** | Una venta: el profesor pide X copias de Y tipo y se anota en la app. |
| **Deuda del aula** | Suma de todas las ventas `estado_pago = 0` y `anulado_at IS NULL` de un aula en el mes. |
| **Liquidación** | Proceso mensual donde la encargada cobra a cada delegado, marca las ventas como pagadas y emite un PDF justificativo. |
| **Batch Entry** | Modo de transcripción: registrar ventas pasadas con su fecha real (ej. transcribir el cuaderno físico el fin de semana). |
| **POS** | Point of Sale — la pantalla principal de registro de ventas. |
| **Encargada** | La operadora principal del negocio (la dueña). Usuario único y primario del sistema. |
| **Centavos (cents)** | Unidad de almacenamiento monetario. S/ 0.10 = 10 cents. S/ 1.50 = 150 cents. Nunca se usan flotantes. |

---

## 1. Contexto del Negocio y Problema a Resolver

### 1.1 Descripción del Negocio

Centro de fotocopias e impresiones ubicado dentro de un colegio de educación primaria. Atiende a profesores de 1° a 6° de primaria en dos turnos: mañana y tarde. El volumen de trabajo se concentra en ventanas de tiempo muy cortas — recreos y cambios de hora — donde la encargada debe registrar múltiples pedidos de varios profesores en secuencia rápida, sin cometer errores de cálculo ni perder el hilo de quién debe qué.

### 1.2 Flujo Operativo Actual (El Problema)

1. El profesor llega, pide "30 copias doble cara del examen".
2. La encargada anota en un cuaderno: aula, cantidad, tipo, precio.
3. Al final del mes, suma manualmente hoja por hoja.
4. Le muestra el total al delegado del aula, quien a veces lo cuestiona.
5. No hay respaldo si el cuaderno se pierde, moja o destruye.

**Puntos de dolor concretos:**
- Errores de suma manual.
- Sin historial verificable ante reclamos.
- Cobro a fin de mes sin desglose claro → disputas frecuentes.
- Transcripción tardía (fines de semana) genera desorden de fechas.
- Sin respaldo digital del negocio.

### 1.3 Solución Propuesta

Aplicación móvil Android con las siguientes propiedades no negociables:

1. **Funciona sin internet.** El 100% de las operaciones diarias (registrar venta, consultar deudas, anular) ocurren contra la base de datos local. Internet es solo para respaldo.
2. **Registro en menos de 10 segundos por pedido.** Interfaz tipo POS con teclado numérico permanente en pantalla.
3. **Desglose imprimible/compartible.** PDF generado localmente, enviable por WhatsApp, con QR de cobro (Yape/Plin) incrustado.
4. **Auditoría completa.** Ningún dato se borra físicamente. Todo queda trazable.
5. **Simple de operar.** La encargada no es técnica. Cero jerga, cero swipes para acciones críticas, botones grandes, confirmaciones explícitas.

---

## 2. Arquitectura General del Sistema

### 2.1 Patrón: Local-First

La UI **nunca espera a la red** para completar una operación. Toda lectura y escritura va contra SQLite embebido en el dispositivo. La sincronización con Supabase es un proceso secundario, silencioso y en segundo plano.

```
+-------------------------------------------------------+
|        Frontend: React Native + Expo (Android)        |
|   (Teléfono principal + Tablet planificada)           |
+-------------------------------------------------------+
                           │
         Lectura/Escritura inmediata (<50ms)
                           ▼
+-------------------------------------------------------+
|          DB Local: SQLite (expo-sqlite v2+)           |
|   Cada dispositivo tiene su propia copia completa     |
+-------------------------------------------------------+
                           │
     SyncWorker en background (solo con WiFi estable)
                           ▼
+-------------------------------------------------------+
|              Red / Internet (Capa de Red)             |
+-------------------------------------------------------+
                           │
           HTTPS REST — Upserts por lotes de 100
                           ▼
+-------------------------------------------------------+
|    Backend BaaS: Supabase (PostgreSQL + Auth + RLS)   |
|      Fuente de verdad para multi-dispositivo          |
+-------------------------------------------------------+
```

### 2.2 Principio de Diseño: Dos Dispositivos, Una Verdad

Aunque hoy el sistema opera en un solo teléfono, la arquitectura contempla desde el inicio la incorporación de una tablet. Esto impone reglas claras:

- **Supabase es la fuente de verdad definitiva** para resolver conflictos entre dispositivos.
- **Cada dispositivo sincroniza de forma independiente.** No hay comunicación directa entre teléfono y tablet.
- **El mecanismo de resolución de conflictos es Last-Write-Wins por `updated_at`.** En la práctica, dado que un solo negocio tiene una sola encargada operando a la vez, los conflictos reales serán mínimos. La estrategia es suficiente y no justifica mayor complejidad.
- **La tablet operará principalmente en modo consulta** (ver deudas, historial) mientras el teléfono es el dispositivo de registro activo. Esta división de roles reduce la probabilidad de conflictos a casi cero.

### 2.3 Estrategia de Sincronización por Lotes

El `SyncWorker` se ejecuta cuando `NetInfo` detecta conexión WiFi estable (no solo datos móviles). El proceso es:

```
1. NetworkProvider detecta WiFi estable
2. SyncWorker consulta: SELECT * FROM [tabla] WHERE is_synced = 0 LIMIT 100
3. Ejecuta upsert en Supabase con { onConflict: 'id' }
4. Si respuesta exitosa (HTTP 200/201):
      UPDATE [tabla] SET is_synced = 1 WHERE id IN ([ids del lote])
5. Repite hasta que no haya registros con is_synced = 0
6. Tablas sincronizadas en orden: productos → ventas → detalle_ventas
   (respetar dependencias de FK)
```

**Importante — Conflicto entre dispositivos:** Si dos dispositivos editan el mismo registro offline, el upsert en Supabase resolverá a favor del `updated_at` más reciente. Para garantizarlo, Supabase tendrá un trigger que rechaza actualizaciones con `updated_at` anterior al valor actual:

```sql
-- Trigger en PostgreSQL (Supabase)
CREATE OR REPLACE FUNCTION prevent_stale_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.updated_at < OLD.updated_at THEN
    RETURN OLD; -- Ignora la actualización vieja, conserva la nueva
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a cada tabla sincronizada
CREATE TRIGGER check_staleness_ventas
BEFORE UPDATE ON ventas
FOR EACH ROW EXECUTE FUNCTION prevent_stale_update();

CREATE TRIGGER check_staleness_productos
BEFORE UPDATE ON productos
FOR EACH ROW EXECUTE FUNCTION prevent_stale_update();
```

---

## 3. Modelo de Base de Datos (v3.0)

**Regla de Oro — Inmutable:** Nunca se usa REAL o FLOAT para valores monetarios. Todo dinero se almacena como INTEGER en centavos. S/ 0.10 → 10. S/ 1.50 → 150. Esta regla no tiene excepciones.

El esquema es idéntico en SQLite local y PostgreSQL en Supabase. Las diferencias de sintaxis entre motores son manejadas por las capas de abstracción correspondientes.

### 3.1 Tabla: `productos`

Catálogo dinámico de servicios. La encargada puede editar precios, crear productos y reordenar su aparición en el POS sin necesidad de actualizar la app.

```sql
CREATE TABLE productos (
    id TEXT PRIMARY KEY NOT NULL,           -- UUID v4 generado en cliente
    nombre TEXT NOT NULL,                   -- Ej: "Copia B/N", "Impresión Color"
    precio_cents INTEGER NOT NULL,          -- Ej: S/ 0.10 → 10
    is_variable INTEGER DEFAULT 0,          -- 1 = solicita precio por modal al tocar
                                            -- 0 = precio fijo, se usa precio_cents
    orden_prioridad INTEGER DEFAULT 0,      -- Menor número = aparece primero en POS
    activo INTEGER DEFAULT 1,              -- 0 = oculto en POS, visible en configuración
    is_synced INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL               -- ISO 8601, ej: "2025-06-15T10:30:00.000Z"
);

CREATE INDEX idx_productos_pos ON productos(activo, orden_prioridad);
```

**Productos iniciales sugeridos (seed data):**

| nombre | precio_cents | is_variable | orden_prioridad |
|---|---|---|---|
| Copia B/N | 10 | 0 | 1 |
| Copia Doble Cara | 15 | 0 | 2 |
| Impresión Color | 50 | 0 | 3 |
| Impresión B/N | 20 | 0 | 4 |
| Servicio Especial | 0 | 1 | 5 |

### 3.2 Tabla: `ventas`

Cabecera de cada transacción. Un registro por pedido de profesor.

```sql
CREATE TABLE ventas (
    id TEXT PRIMARY KEY NOT NULL,           -- UUID v4 generado en cliente
    fecha_venta TEXT NOT NULL,             -- Fecha real del evento: "2025-06-15"
                                            -- En Batch Entry: fecha del cuaderno físico
                                            -- En ventas normales: fecha actual del dispositivo
    fecha_registro TEXT NOT NULL,          -- Timestamp exacto de creación: ISO 8601
                                            -- Siempre es "ahora". Nunca editable.
                                            -- Para auditoría: saber cuándo se digitó
    turno TEXT NOT NULL,                   -- "Mañana" | "Tarde"
    aula TEXT NOT NULL,                    -- Ej: "3° A", "5° B"
    total_cents INTEGER NOT NULL,          -- Suma de subtotal_cents de sus líneas
    estado_pago INTEGER DEFAULT 0,         -- 0 = Pendiente | 1 = Pagado
    anulado_at TEXT,                       -- NULL = activa | ISO 8601 = anulada (Soft Delete)
    motivo_anulacion TEXT,                 -- Requerido si anulado_at no es NULL
    is_synced INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL
);

-- Índice compuesto para reportes mensuales por aula
CREATE INDEX idx_ventas_reportes ON ventas(estado_pago, anulado_at, fecha_venta, aula);

-- Índice para el SyncWorker (registros pendientes)
-- NOTA: Se usa índice simple (no parcial) por compatibilidad con SQLite en Android antiguo
CREATE INDEX idx_ventas_sync ON ventas(is_synced);
```

**Sobre la separación `fecha_venta` / `fecha_registro`:**
Esta distinción es central para la operación real del negocio. La encargada frecuentemente transcribe el cuaderno físico los fines de semana. En ese escenario:
- `fecha_venta = "2025-06-12"` (el jueves que ocurrió el pedido)
- `fecha_registro = "2025-06-15T09:30:00Z"` (el domingo que se digitó)

Los reportes mensuales y las deudas por aula siempre agrupan por `fecha_venta`. La `fecha_registro` es solo para auditoría interna.

### 3.3 Tabla: `detalle_ventas`

Líneas de detalle de cada venta. Una fila por tipo de producto dentro de un pedido.

```sql
CREATE TABLE detalle_ventas (
    id TEXT PRIMARY KEY NOT NULL,
    venta_id TEXT NOT NULL,
    producto_id TEXT,                          -- Referencia al catálogo actual
                                               -- Puede ser NULL si el producto fue eliminado
    producto_nombre TEXT NOT NULL,             -- SNAPSHOT: nombre al momento de la venta
                                               -- Persiste aunque se renombre o elimine el producto
    cantidad INTEGER NOT NULL,
    precio_unitario_cents INTEGER NOT NULL,    -- SNAPSHOT: precio al momento de la venta
                                               -- Si el precio sube mañana, esto no cambia
    subtotal_cents INTEGER NOT NULL,           -- = cantidad * precio_unitario_cents
                                               -- Calculado en cliente, verificado al insertar
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE
);

-- Índice para lookup de líneas por venta (crítico para reportes y pantalla de detalle)
CREATE INDEX idx_detalle_venta_id ON detalle_ventas(venta_id);
```

**Por qué los SNAPSHOTs son no negociables:** Si la "Copia B/N" sube de S/0.10 a S/0.20, las deudas del mes anterior deben mantener S/0.10. Sin el snapshot, el recalculo retroactivo destruye la integridad contable y genera disputas con los profesores.

### 3.4 Tabla: `app_config`

Control de versión del esquema local y configuración general de la app.

```sql
CREATE TABLE app_config (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Registros iniciales
INSERT INTO app_config (key, value) VALUES ('db_version', '1');
INSERT INTO app_config (key, value) VALUES ('turno_activo', 'Mañana');  -- Persiste entre sesiones
INSERT INTO app_config (key, value) VALUES ('ultimo_backup', NULL);     -- Fecha del último backup manual
```

---

## 4. Sistema de Migraciones (Transacciones Atómicas)

### 4.1 El Problema que Resuelve

Sin transacciones, una migración interrumpida a mitad (por llamada telefónica, Android matando el proceso, batería muerta) deja la BD en estado corrupto: el schema está a medias pero `db_version` no se actualizó. La próxima apertura de la app intenta la misma migración sobre un schema parcial → crash.

### 4.2 Implementación

Cada migración es una función que envuelve **todas sus operaciones SQL en una transacción atómica**. Si cualquier paso falla, se hace rollback completo y la BD queda exactamente como estaba. La próxima apertura reintenta desde cero de forma segura.

```javascript
// src/database/migrations.js

const MIGRATIONS = [
  // V1 → V2: Ejemplo futuro — agregar campo de descuento
  {
    version: 2,
    run: async (db) => {
      await db.execAsync(`
        BEGIN TRANSACTION;

        ALTER TABLE productos ADD COLUMN descuento_cents INTEGER DEFAULT 0;

        UPDATE app_config
        SET value = '2'
        WHERE key = 'db_version';

        COMMIT;
      `);
    }
  },

  // V2 → V3: Otro ejemplo futuro
  {
    version: 3,
    run: async (db) => {
      await db.execAsync(`
        BEGIN TRANSACTION;

        ALTER TABLE ventas ADD COLUMN nota_interna TEXT;

        UPDATE app_config
        SET value = '3'
        WHERE key = 'db_version';

        COMMIT;
      `);
    }
  }
];

export async function runMigrations(db) {
  const result = await db.getFirstAsync(
    "SELECT value FROM app_config WHERE key = 'db_version'"
  );
  const currentVersion = parseInt(result?.value ?? '1', 10);

  const pending = MIGRATIONS.filter(m => m.version > currentVersion);

  for (const migration of pending) {
    try {
      await migration.run(db);
      console.log(`[DB] Migración V${migration.version} aplicada correctamente.`);
    } catch (error) {
      // El ROLLBACK ya ocurrió automáticamente al fallar el COMMIT
      console.error(`[DB] Migración V${migration.version} falló. BD sin cambios.`, error);
      throw error; // Propagar para que la app muestre error y no siga con schema corrupto
    }
  }
}
```

### 4.3 Flujo de Inicialización

```
App.js abre/crea la base de datos SQLite
          │
          ▼
¿Existen las tablas base? ──No──▶ Ejecutar createSchema() (crea todas las tablas + seed data)
          │
         Sí
          ▼
runMigrations(db)
          │
    ¿Hay migraciones pendientes?
         │
   No ───┘    Sí ──▶ Ejecutar en orden secuencial con transacción atómica
          │
          ▼
App lista para operar
```

---

## 5. Autenticación y Gestión de Sesión

### 5.1 Modelo de Autenticación

La app usa una **cuenta única fija** (`admin@negocio.com`) vinculada al negocio, no a una persona. Esto simplifica la operación: no hay login manual en el día a día. La sesión se establece una sola vez por dispositivo y se mantiene indefinidamente mediante refresh automático.

**Por qué una cuenta, no varias:** El negocio tiene una sola operadora. Agregar roles o múltiples usuarios agrega complejidad operativa innecesaria. Si en el futuro se incorpora una segunda persona, se añade ese feature entonces, no ahora.

### 5.2 Ciclo de Vida de la Sesión

```javascript
// src/services/authService.js

import { supabase } from './supabaseClient';
import * as SecureStore from 'expo-secure-store';

// Al iniciar la app
export async function initSession() {
  // 1. Intentar recuperar sesión existente de SecureStore
  const storedSession = await SecureStore.getItemAsync('supabase_session');

  if (storedSession) {
    const session = JSON.parse(storedSession);
    await supabase.auth.setSession(session);
  }

  // 2. Supabase intentará auto-refresh del JWT automáticamente
  // Este listener maneja todos los cambios de estado de sesión
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      // Guardar sesión actualizada en almacenamiento seguro
      await SecureStore.setItemAsync('supabase_session', JSON.stringify(session));
    }

    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_FAILED') {
      // El token expiró y no se pudo renovar (sin internet por mucho tiempo)
      // Mostrar pantalla de reconexión — NO bloquear funciones offline
      showReconnectBanner(); // Componente de UI no bloqueante
    }
  });
}

// Si el token falla definitivamente, re-autenticar
export async function reauthenticate() {
  const { error } = await supabase.auth.signInWithPassword({
    email: 'admin@negocio.com',
    password: process.env.EXPO_PUBLIC_APP_PASSWORD
  });

  if (error) {
    // Solo afecta la sync. Las funciones offline siguen operando.
    console.error('[Auth] Re-autenticación fallida. Modo offline completo.');
  }
}
```

### 5.3 Comportamiento Crítico: La Sesión Expirada NO Bloquea la App

Si el JWT expira (escenario: vacaciones de 3 semanas sin internet), la app sigue funcionando en modo offline completo. Solo la sincronización con Supabase queda en pausa. La encargada verá un banner no bloqueante: **"Respaldo en pausa — toca para reconectar"**. El banner desaparece cuando la sync se restablece exitosamente.

---

## 6. Reglas de Negocio y Casos Extremos

### 6.1 Inmutabilidad Financiera

- **Nunca FLOAT para dinero.** Ver sección 3 — Regla de Oro.
- **Snapshot obligatorio en cada venta.** `producto_nombre` y `precio_unitario_cents` se copian al momento de crear el `detalle_ventas`. El catálogo puede cambiar libremente; las ventas pasadas no se ven afectadas.
- **`total_cents` en `ventas` = suma de `subtotal_cents` de sus líneas.** Se calcula en el cliente antes de insertar y se verifica que coincida. No se recalcula después.

### 6.2 Soft Delete — Anulación de Ventas

Las ventas **nunca se borran físicamente**. Una venta anulada tiene `anulado_at` con un timestamp. Esto garantiza que ante cualquier reclamo ("¿por qué en enero aparecí con S/15 si ya pagué?") la encargada puede mostrar el rastro completo incluyendo la anulación.

**Flujo de anulación:**

```
Encargada abre el detalle de una venta activa
          │
          ▼
Presiona botón "Anular Venta" (rojo, grande)
          │
          ▼
Alert.alert nativo: "¿Anular esta venta?"
"Esta acción quedará registrada. No se puede deshacer."
[Cancelar]  [Confirmar anulación]
          │
         Confirmar
          ▼
Modal solicita motivo: "Error de cantidad" / "Pedido cancelado" / "Otro"
          │
          ▼
UPDATE ventas SET anulado_at = [now()], motivo_anulacion = [motivo], updated_at = [now()]
WHERE id = [id]
          │
          ▼
Opción inmediata: "¿Registrar venta correcta ahora?"
[No]  [Sí — ir al POS con fecha prellenada]
```

Las ventas anuladas se excluyen de todos los reportes de deuda (`WHERE anulado_at IS NULL`) pero son visibles en el módulo de Auditoría/Historial para el administrador.

### 6.3 Batch Entry — Transcripción de Cuadernos

La encargada transcribe el cuaderno físico los fines de semana. En este modo:

- La pantalla de registro muestra un **selector de fecha** (por defecto hoy, editable hacia atrás).
- El sistema usa la fecha seleccionada como `fecha_venta`.
- `fecha_registro` siempre es el timestamp real de digitación.
- Los reportes agrupan por `fecha_venta`, por lo que la transcripción tardía no distorsiona el historial.
- No hay límite de cuántos días atrás se puede transcribir.

**Qué no se puede hacer en Batch Entry:** No se puede seleccionar una fecha futura. La validación en cliente rechaza `fecha_venta > fecha_actual`.

### 6.4 Edge Case: Buffer Vacío en el POS

Si la encargada toca un producto sin haber ingresado una cantidad en el pad numérico (buffer en 0 o vacío):

- La app **no registra nada**.
- El botón del producto muestra un shake visual breve (animación de 300ms).
- Se dispara un haptic de advertencia (`Haptics.notificationAsync(NotificationFeedbackType.Warning)`).
- No aparece ningún modal ni mensaje de error — el feedback visual y háptico es suficiente para la operadora experimentada.

### 6.5 Productos de Precio Variable

Algunos servicios no tienen precio fijo (ej. "Servicio Especial", espiralado, plastificado). Si `is_variable = 1`:

- Al tocar el producto en el POS, aparece un modal con un campo numérico para ingresar el precio en soles (la app convierte a centavos internamente).
- El modal muestra la cantidad ya ingresada en el buffer.
- El usuario ingresa el precio → confirma → se agrega al carrito.
- El modal tiene cancelar para abortar sin agregar al carrito.

---

## 7. Módulos del Frontend

### 7.1 Stack Tecnológico

| Dependencia | Versión | Uso |
|---|---|---|
| `expo` | SDK 51+ | Runtime y build |
| `expo-sqlite` | v2+ | Base de datos local |
| `expo-haptics` | latest | Feedback háptico |
| `expo-print` | latest | Generación de PDFs locales |
| `expo-sharing` | latest | Share sheet (WhatsApp, Drive, etc.) |
| `expo-secure-store` | latest | Almacenamiento seguro del JWT |
| `@react-native-community/netinfo` | latest | Detección de conectividad |
| `@supabase/supabase-js` | v2 | Cliente de Supabase |
| `react-navigation` | v6 | Navegación (Bottom Tabs + Stack) |
| `react-native-reanimated` | latest | Animaciones (shake en edge case) |

**Dependencias eliminadas vs v2.0:**
- ~~`react-native-draggable-flatlist`~~ — Reemplazado por botones ↑↓. Misma funcionalidad, cero complejidad de build.

### 7.2 Estructura de Directorios

```
/
├── assets/
│   ├── qr-yape.png                  # QR estático de Yape del negocio
│   └── qr-plin.png                  # QR estático de Plin del negocio
│
├── src/
│   ├── components/
│   │   ├── NumPad.jsx               # Teclado numérico estático del POS
│   │   ├── ProductButton.jsx        # Botón de producto con animación shake
│   │   ├── CartItem.jsx             # Línea del carrito en el POS
│   │   ├── AulaCard.jsx             # Tarjeta de deuda por aula
│   │   ├── SyncStatusIcon.jsx       # Ícono de nube en el header (verde/naranja+número)
│   │   ├── ReconnectBanner.jsx      # Banner no bloqueante de sesión expirada
│   │   └── ConfirmModal.jsx         # Modal de confirmación reutilizable
│   │
│   ├── context/
│   │   ├── DbContext.jsx            # Inicialización de SQLite, migraciones, provider
│   │   └── VentaContext.jsx         # Estado del carrito activo en el POS
│   │
│   ├── database/
│   │   ├── schema.js                # CREATE TABLE statements (v3.0)
│   │   ├── migrations.js            # Sistema de migraciones atómicas
│   │   ├── seed.js                  # Datos iniciales (productos base)
│   │   └── queries/
│   │       ├── ventas.js            # INSERT, UPDATE, soft delete, getByAula
│   │       ├── productos.js         # CRUD de catálogo
│   │       ├── reportes.js          # Queries de resumen diario y mensual
│   │       └── sync.js              # SELECT WHERE is_synced = 0
│   │
│   ├── navigation/
│   │   └── AppNavigator.jsx         # Bottom Tabs: Inicio | POS | Salones | Historial | Config
│   │
│   ├── screens/
│   │   ├── HomeScreen.jsx           # Resumen del día (pantalla principal)
│   │   ├── POSScreen.jsx            # Registro de ventas
│   │   ├── SalonesScreen.jsx        # Deudas por aula
│   │   ├── AulaDetailScreen.jsx     # Detalle de ventas de un aula específica
│   │   ├── HistorialScreen.jsx      # Historial completo con auditoría y anuladas
│   │   ├── ConfigScreen.jsx         # Configuración: catálogo, turno, backup
│   │   └── ProductoEditScreen.jsx   # Alta/edición de producto individual
│   │
│   └── services/
│       ├── pdfService.js            # Generación de HTML → PDF con expo-print
│       ├── syncWorker.js            # Lógica de sync por chunks con Supabase
│       ├── authService.js           # Gestión de sesión y auto-refresh JWT
│       ├── backupService.js         # Exportación manual de respaldo JSON
│       └── hapticService.js         # Wrappers de expo-haptics por tipo de acción
│
└── App.js                           # Punto de entrada: init DB → migraciones → navigation
```

### 7.3 Pantalla: Home (Resumen del Día)

**Propósito:** Dar contexto inmediato al abrir la app. La encargada ve de un vistazo cómo va el día antes de empezar a registrar.

**Contenido:**
- Fecha actual y turno activo (selector Mañana/Tarde persistido en `app_config`).
- Total vendido hoy en soles (suma de `total_cents` de ventas del día con `anulado_at IS NULL`).
- Lista de aulas con deuda activa (en rojo), ordenadas por monto descendente.
- Aulas al día (en verde), colapsadas para no saturar la vista.
- Botón grande central: **"+ Nueva Venta"** → navega al POS.
- Ícono de estado de sync en el header (ver sección 7.7).

### 7.4 Pantalla: POS (Point of Sale)

**Propósito:** Registro de una venta completa en menos de 10 segundos.

**Layout (de arriba a abajo):**

```
┌─────────────────────────────────────┐
│  [←]  Nueva Venta — Turno: Mañana  │  ← Header con turno activo
├─────────────────────────────────────┤
│  Aula: [3° A  ▼]   Fecha: [Hoy  ✎] │  ← Selector de aula + fecha (Batch Entry)
├─────────────────────────────────────┤
│                                     │
│  [CARRITO — items agregados]        │  ← Lista scrollable de líneas del carrito
│  Copia B/N  x30  = S/ 3.00         │
│  Imp. Color x 5  = S/ 2.50         │
│                                     │
│  TOTAL: S/ 5.50                     │
├─────────────────────────────────────┤
│  [Copia B/N]  [Copia D/C]  [Imp.C] │  ← Botones de productos (grilla 2-3 col)
│  [Imp. B/N ]  [Serv. Esp.]         │
├─────────────────────────────────────┤
│  [ 7 ]  [ 8 ]  [ 9 ]               │
│  [ 4 ]  [ 5 ]  [ 6 ]  [⌫]         │  ← Pad numérico estático
│  [ 1 ]  [ 2 ]  [ 3 ]               │
│  [ 0 ]  [00]   [CONFIRMAR VENTA]   │
└─────────────────────────────────────┘
```

**Flujo de uso:**
1. Encargada selecciona aula (selector).
2. Digita cantidad en el pad (ej. `3 0`).
3. Toca el producto (ej. "Copia B/N") → se agrega al carrito, el buffer se limpia, haptic suave.
4. Repite pasos 2-3 para más productos.
5. Toca "Confirmar Venta" → Alert de confirmación → inserta en SQLite → carrito se limpia.

**Si toca producto con buffer vacío:** Shake visual en el botón del producto + haptic de advertencia. No pasa nada más.

**Confirmar Venta con carrito vacío:** Botón deshabilitado visualmente (opacidad 0.4). No tiene acción.

### 7.5 Pantalla: Salones (Deudas por Aula)

**Propósito:** Vista consolidada de qué aulas deben dinero.

```sql
-- Query base de esta pantalla
SELECT
  aula,
  turno,
  SUM(total_cents) AS deuda_cents,
  COUNT(*) AS num_pedidos
FROM ventas
WHERE estado_pago = 0
  AND anulado_at IS NULL
  AND strftime('%Y-%m', fecha_venta) = strftime('%Y-%m', 'now')  -- Mes actual
GROUP BY aula, turno
ORDER BY deuda_cents DESC;
```

**Cada tarjeta de aula muestra:**
- Nombre del aula y turno.
- Total de deuda en soles (rojo si > 0, verde si = 0).
- Número de pedidos pendientes.
- Botón "Ver detalle" → `AulaDetailScreen`.
- Botón "Marcar como Pagado" (grande, verde) → Alert de confirmación → `UPDATE ventas SET estado_pago = 1`.

**No hay swipes.** Todas las acciones son botones explícitos con confirmación nativa.

### 7.6 Pantalla: Configuración — Catálogo de Productos

**Propósito:** Permite a la encargada editar el catálogo sin tocar código.

**Lista de productos con por cada uno:**
- Nombre editable.
- Precio actual.
- Switch "Precio Variable".
- Switch "Activo en POS".
- Botones **↑** y **↓** para reordenar (actualizan `orden_prioridad` en SQLite localmente).

**Por qué ↑↓ en vez de Drag & Drop:**
El drag & drop en React Native requiere librerías de terceros que frecuentemente generan incompatibilidades con Expo y problemas en builds de producción. El reordenamiento con botones es igualmente funcional para un catálogo de 5-10 productos, sin dependencias adicionales y sin posibilidad de errores en gestos.

### 7.7 Indicador de Estado de Sincronización

Ícono de nube en el header superior de toda la app (componente global):

| Estado | Ícono | Descripción |
|---|---|---|
| Todo sincronizado | ☁️ verde | `SELECT COUNT(*) WHERE is_synced = 0` = 0 |
| Pendientes | 🟠 con número | Cantidad de registros no sincronizados |
| Sin conexión | ☁️ gris | NetInfo indica sin red |
| Sync activa | ☁️ animado | SyncWorker ejecutándose en este momento |

Al tocar el ícono: pantalla de detalle mostrando cuántos registros de cada tabla están pendientes.

---

## 8. Módulo de Reportes y PDF

### 8.1 Generación Local de PDF

El PDF se construye enteramente en el dispositivo, sin servidor. Se usa `expo-print` que renderiza HTML interno a PDF.

**Contenido del PDF de liquidación mensual por aula:**
- Header: nombre del negocio, mes, aula, turno.
- Tabla de ventas: fecha, descripción, cantidad, precio unitario, subtotal.
- Subtotal por categoría de producto.
- **Total a pagar en soles** (destacado).
- QR de Yape y/o Plin (imagen en Base64 incrustada — funciona offline).
- Footer: fecha de emisión del reporte.

**Advertencia de implementación:** El HTML para `expo-print` se renderiza en un WebView interno de Android. Los estilos CSS deben ser probados en un dispositivo Android real (no emulador) desde el inicio del desarrollo. Los estilos `flexbox` y `grid` pueden comportarse diferente. Se recomienda usar tablas HTML clásicas para el layout del PDF — más predecibles en este contexto.

### 8.2 Flujo de Emisión y Envío

```
Encargada en AulaDetailScreen toca "Generar PDF"
          │
          ▼
pdfService.js construye el HTML con los datos del mes
          │
          ▼
expo-print genera el archivo PDF en almacenamiento temporal del dispositivo
          │
          ▼
expo-sharing abre el Share Sheet nativo de Android
          │
          ▼
La encargada selecciona WhatsApp → elige el chat del delegado → envía
```

---

## 9. Módulo de Backup Manual

### 9.1 Por qué es Necesario

La sincronización con Supabase es el respaldo primario, pero opera de forma silenciosa y requiere internet. Si el teléfono se pierde, rompe o resetea **antes de que haya tenido conexión a internet** desde la última venta, esos datos se perderían. El backup manual es el seguro del seguro.

### 9.2 Implementación

**Ubicación:** Pantalla de Configuración → sección "Respaldo" → botón "Exportar respaldo ahora".

**Qué exporta:** Un archivo `respaldo_[fecha].json` con todas las tablas (productos, ventas, detalle_ventas) en formato JSON. Las ventas anuladas también se incluyen (es un backup completo, no un reporte).

```javascript
// src/services/backupService.js

export async function exportBackup(db) {
  const productos = await db.getAllAsync('SELECT * FROM productos');
  const ventas = await db.getAllAsync('SELECT * FROM ventas');
  const detalles = await db.getAllAsync('SELECT * FROM detalle_ventas');

  const backup = {
    version: '3.0',
    exported_at: new Date().toISOString(),
    data: { productos, ventas, detalle_ventas: detalles }
  };

  const json = JSON.stringify(backup, null, 2);
  const filename = `respaldo_${new Date().toISOString().slice(0, 10)}.json`;

  // Escribir a FileSystem temporal
  const uri = FileSystem.documentDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, json);

  // Abrir Share Sheet (WhatsApp, Drive, email, etc.)
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Guardar respaldo de la app'
  });

  // Registrar fecha del último backup
  await db.runAsync(
    "UPDATE app_config SET value = ? WHERE key = 'ultimo_backup'",
    [new Date().toISOString()]
  );
}
```

**Pantalla de Configuración muestra:** "Último respaldo manual: [fecha]" o "Nunca" si no se ha hecho. Recordatorio visual si el último backup tiene más de 7 días.

**El archivo JSON puede ser restaurado** en caso de pérdida del teléfono mediante una pantalla de "Importar respaldo" en la configuración (scope de desarrollo futuro, documentar pero no implementar en v1).

---

## 10. Backend: Supabase

### 10.1 Configuración del Proyecto

- **Plan gratuito de Supabase** es suficiente para este volumen de datos.
- **Base de datos:** PostgreSQL con el mismo esquema que SQLite local.
- **Auth:** Habilitado. Una cuenta: `admin@negocio.com`.
- **RLS (Row Level Security):** Habilitado en todas las tablas.

### 10.2 Row Level Security (RLS)

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Política: solo usuarios autenticados pueden operar sus datos
-- (En este negocio, siempre será la misma cuenta admin@negocio.com)
CREATE POLICY "Solo usuario autenticado"
ON public.ventas FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Aplicar la misma política a las demás tablas
CREATE POLICY "Solo usuario autenticado"
ON public.productos FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Solo usuario autenticado"
ON public.detalle_ventas FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
```

### 10.3 Trigger Anti-Escritura Vieja (Multi-Dispositivo)

```sql
-- Evita que una sync tardía del teléfono sobreescriba datos más nuevos de la tablet
CREATE OR REPLACE FUNCTION prevent_stale_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.updated_at < OLD.updated_at THEN
    RETURN OLD;  -- Descarta la actualización vieja
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_staleness_ventas
BEFORE UPDATE ON ventas
FOR EACH ROW EXECUTE FUNCTION prevent_stale_update();

CREATE TRIGGER check_staleness_productos
BEFORE UPDATE ON productos
FOR EACH ROW EXECUTE FUNCTION prevent_stale_update();

CREATE TRIGGER check_staleness_detalle_ventas
BEFORE UPDATE ON detalle_ventas
FOR EACH ROW EXECUTE FUNCTION prevent_stale_update();
```

---

## 11. UX: Principios para Entornos de Alta Presión

El recreo escolar es un entorno hostil para una app. Hay ruido, prisa, el teléfono puede estar en una mano, los profesores esperan. Estos principios no son opcionales:

**1. Cero swipes para acciones irreversibles.**
Anular, marcar como pagado, eliminar producto — todo se hace con botones grandes y Alert.alert() de confirmación nativa. Un swipe accidental en un recreo concurrido puede costar dinero real.

**2. Feedback háptico como confirmación silenciosa.**
En el recreo hay ruido. La encargada no puede escuchar sonidos de confirmación. El haptic en la muñeca confirma que la acción se registró sin que tenga que mirar la pantalla.

| Acción | Haptic |
|---|---|
| Producto agregado al carrito | `ImpactFeedbackStyle.Light` |
| Venta confirmada exitosamente | `ImpactFeedbackStyle.Heavy` |
| Buffer vacío al tocar producto | `NotificationFeedbackType.Warning` |
| Error / operación fallida | `NotificationFeedbackType.Error` |

**3. Teclado numérico estático.**
El pad numérico nunca se oculta, nunca sube, nunca se mueve. No se usa el teclado del sistema operativo (que aparece y desaparece y requiere un tap adicional para cerrarse). El pad de la app es permanente en el tercio inferior de la pantalla.

**4. Selectores de aula predecibles.**
El selector de aula en el POS recuerda la última aula seleccionada. En un recreo típico, la encargada atiende 3-5 pedidos del mismo bloque de aulas. No tener que reseleccionar cada vez ahorra segundos reales.

**5. Confirmaciones cortas y directas.**
Los textos de Alert son directos: "¿Confirmar venta de S/ 5.50 para 3° A?" — no "¿Está usted segura de que desea proceder con el registro de esta transacción?".

---

## 12. Plan de Implementación

### Fase 1 — Cimientos y Core Offline (Semanas 1-2)

- Setup de Expo SDK, configuración de `expo-sqlite` v2.
- Implementación del schema v3.0 completo con índices correctos.
- Sistema de migraciones atómicas (`migrations.js`).
- Seed data con productos base.
- `DbContext`: inicialización y exposición de la DB a toda la app.
- **POS Screen completo:** pad numérico, botones de productos, carrito, confirmación.
- Edge case buffer vacío (shake + haptic).
- Productos de precio variable (modal de precio).
- `VentaContext`: estado del carrito activo.

### Fase 2 — Deudas, Reportes y Configuración (Semanas 3-4)

- **HomeScreen:** resumen del día, lista de aulas con deuda, botón "Nueva Venta".
- **SalonesScreen:** deudas por aula con query agrupado por `fecha_venta`.
- **AulaDetailScreen:** listado de ventas de un aula, flujo de anulación completo.
- **Generación de PDF** con `expo-print` (testar en Android real desde el inicio).
- Integración de QR en Base64 en el PDF.
- `expo-sharing` para envío por WhatsApp.
- **ConfigScreen:** lista de productos con botones ↑↓ y switches.
- **ProductoEditScreen:** alta y edición de productos.
- Selector de fecha en POS para Batch Entry.

### Fase 3 — Sincronización, Auth y Backup (Semana 5)

- Setup de proyecto Supabase (tablas, RLS, triggers).
- `authService.js`: login inicial, auto-refresh JWT, banner de reconexión.
- `syncWorker.js`: chunks de 100, orden de tablas, manejo de errores de red.
- `SyncStatusIcon`: integración en header global.
- `backupService.js`: exportación JSON con `expo-sharing`.
- Indicador de "Último backup" en ConfigScreen.

### Fase 4 — Historial, Auditoría y Entrega (Semana 6)

- **HistorialScreen:** historial completo incluyendo ventas anuladas (para auditoría).
- Pruebas de Batch Entry: transcripción de 100+ ventas con fechas pasadas.
- Pruebas de sync: simular 2 semanas sin internet → reconectar → verificar integridad.
- Compilación de APK de producción y prueba en dispositivo real de la encargada.
- Sesión de capacitación y entrega.

---

## 13. Decisiones de Diseño Documentadas

Esta sección registra el **por qué** de las decisiones no obvias, para que cualquier desarrollador futuro entienda el razonamiento y no revierta decisiones sin darse cuenta.

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Botones ↑↓ para reordenar | Drag & Drop (`react-native-draggable-flatlist`) | Librería con historial de incompatibilidades con Expo. Para 5-10 productos, los botones son equivalentes en funcionalidad. |
| Índice simple en `is_synced` | Índice parcial `WHERE is_synced = 0` | Los índices parciales requieren SQLite 3.8.9+. Dispositivos Android baratos pueden tener versiones más antiguas. El índice simple tiene performance aceptable para este volumen. |
| Una sola cuenta de Supabase | Auth multi-usuario | El negocio tiene una sola operadora. Agregar roles agrega complejidad sin beneficio real ahora. |
| Last-Write-Wins por `updated_at` | CRDT o resolución manual de conflictos | El negocio opera con una sola persona. Los conflictos reales son estadísticamente mínimos. LWW es correcto y suficiente. |
| Alertas nativas `Alert.alert()` | Modales personalizados en React | Las alertas nativas de Android no pueden ser ignoradas por un toque accidental fuera del modal. Son más seguras para acciones críticas en un entorno de alta presión. |
| No hay "cierre de caja" formal | Módulo de cierre de caja diario | El modelo de deuda-por-aula ya provee el control financiero necesario. Un cierre de caja agrega complejidad operativa sin valor agregado para este negocio específico. |
| INTEGER centavos para dinero | REAL / FLOAT | Los flotantes generan errores de redondeo acumulativos. En un reporte mensual con 200+ ventas, esos errores son visibles y destruyen la confianza del sistema. |
