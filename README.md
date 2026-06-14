# 📋 POS CopyCenter — Sistema de Control de Fotocopias Escolares

![Expo SDK](https://img.shields.io/badge/Expo_SDK-52-000?logo=expo)
![React Native](https://img.shields.io/badge/React_Native-0.74-61dafb?logo=react)
![Platform](https://img.shields.io/badge/Platform-Android-3ddc84?logo=android)
![SQLite](https://img.shields.io/badge/DB-SQLite_+_Supabase-003b57?logo=sqlite)

---

## ✨ La Historia Detrás de Este Proyecto

Mi mamá tiene un pequeño centro de fotocopiado dentro de un colegio. Durante años, llevó todas las cuentas **a mano**: anotaba en un cuaderno cada fotocopia que cada profesor pedía, y al final del mes sumaba hoja por hoja para saber cuánto le debía cada salón.

Era un proceso tedioso que le tomaba horas. Horas que perfectamente podía pasar con mi hermana y conmigo.

Un día, mientras la veía sumar columnas enteras de números con una calculadora en una mano y un cuaderno en la otra, pensé: *"Tiene que haber una mejor manera de realizar esto"*.

Así nació **POS CopyCenter**.

No es una app genérica de facturación. Es una herramienta construida **para ella**, pensando en su flujo de trabajo real:
- Los pedidos llegan en ráfagas durante los recreos (5 minutos para atender a 3 profesores)
- No siempre hay internet
- Los reportes tienen que ser claros porque los delegados de aula los revisan
- El respaldo tiene que ser automático porque un cuaderno se puede perder

Hoy mi mamá usa la app en su teléfono Android. Toca 3 botones, registra un pedido en menos de 10 segundos, y al final del mes genera un PDF con todo el detalle para cada salón. Lo comparto en GitHub porque sé que hay otros pequeños negocios de fotocopiado con el mismo problema.

---

## 🎯 ¿Qué Hace Esta App?

POS CopyCenter es un sistema POS (**Point of Sale**) offline-first para centros de fotocopiado dentro de colegios:

| Funcionalidad | Descripción |
|---|---|
| **Registro rápido de ventas** | Teclado numérico permanente. 3 toques = 1 venta. |
| **Gestión por aulas y turnos** | Cada salón (1°A, 3°B, etc.) tiene su propia cuenta por turno (Mañana/Tarde). |
| **Control de deudas mensuales** | Al final del mes, sabes exactamente cuánto debe cada aula. |
| **Batch Entry** | Transcribe pedidos pasados con su fecha real (cuaderno → app). |
| **Generación de PDF** | Reporte detallado por aula con QR de pago (Yape/Plin) incrustado. |
| **Sincronización en la nube** | Respaldo automático con Supabase cuando hay WiFi. |
| **Modo offline completo** | 100% funcional sin internet. La sincronización nunca bloquea. |
| **Anulación con auditoría** | Las ventas anuladas quedan registradas con motivo y timestamp. |

---

## 🏗️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Framework** | React Native + Expo SDK 52 |
| **Lenguaje** | JavaScript (JSX) |
| **Base de datos local** | SQLite via `expo-sqlite` |
| **Base de datos nube** | Supabase (PostgreSQL + Auth + RLS) |
| **Navegación** | React Navigation 6 (Bottom Tabs + Native Stack) |
| **PDF** | `expo-print` (HTML → PDF local, sin servidor) |
| **Hápticos** | `expo-haptics` (feedback táctil confirmatorio) |
| **Almacenamiento seguro** | `expo-secure-store` |

### Arquitectura: Offline-First

```
App → SQLite Local (lectura/escritura inmediata)
       ↕ (en segundo plano, solo WiFi)
       Supabase (fuente de verdad para multi-dispositivo)
```

Toda operación se escribe primero en SQLite local. La sincronización con la nube es un proceso secundario que ocurre automáticamente cuando hay WiFi. **Sin internet, la app funciona igual.**

---

## 📱 Requisitos del Sistema

### Para compilar/ejecutar en desarrollo

#### Linux (Ubuntu/Debian)
```bash
# 1. Instalar Node.js 22+ (recomendado)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Instalar dependencias del sistema para React Native
sudo apt-get install -y openjdk-17-jdk wget unzip

# 3. Instalar Android Studio (para emulador y SDK)
# Descargar desde: https://developer.android.com/studio

# 4. Configurar variables de entorno
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
```

#### Windows (con WSL2/Ubuntu)
Para compilar en Windows se necesita **WSL2 con Ubuntu** porque las herramientas de Expo para Android requieren un entorno Unix:

```powershell
# 1. Instalar WSL2 con Ubuntu (PowerShell como Administrador)
wsl --install -d Ubuntu

# 2. Dentro de Ubuntu, instalar Android Studio y Node.js
# (seguir los pasos de Linux arriba)

# 3. IMPORTANTE: Configurar los permisos de la consola de Ubuntu
# Desde Windows, crear un acceso directo a: ubuntu.exe
# Así podrás ejecutar los comandos de Expo desde la terminal de Ubuntu
```

#### macOS
```bash
# 1. Instalar Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Instalar Node.js y dependencias
brew install node@22
brew install openjdk@17

# 3. Instalar Xcode (desde App Store) para iOS
# 4. Instalar Android Studio para Android
```

---

## 🚀 Cómo Empezar

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/pos-copycenter.git
cd pos-copycenter

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo
npx expo start

# 4. Escanear el QR con Expo Go (teléfono) o presionar 'a' para Android emulador
```

### Construir APK de producción

#### Opción 1: EAS Build (recomendado — sin Android Studio)

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Loguearse (abre el navegador)
eas login

# Build APK de preview
eas build --platform android --profile preview

# Build de producción
eas build --platform android --profile production
```

EAS Build genera un **APK universal** que funciona en todas las arquitecturas. Es la forma más simple de obtener un instalable.

#### Opción 2: Build local con `expo run:android`

Requiere Android Studio y el SDK de Android instalados.

```bash
# 1. Generar los archivos nativos (solo la primera vez)
npx expo prebuild --platform android

# 2. Compilar APK universal (todas las arquitecturas)
cd android
./gradlew assembleRelease

# El APK se genera en:
# android/app/build/outputs/apk/release/app-release.apk
```

#### Opción 3: APK por arquitectura específica

Para reducir el tamaño del APK, puedes generar versiones separadas por arquitectura:

```bash
# APK para dispositivos modernos (ARM 64 bits) — RECOMENDADO
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# → android/app/build/outputs/apk/release/app-arm64-v8a-release.apk

# APK para dispositivos antiguos (ARM 32 bits)
./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a

# APK para emuladores (x86_64)
./gradlew assembleRelease -PreactNativeArchitectures=x86_64

# APK universal (todas las arquitecturas — ~50MB más grande)
./gradlew assembleRelease
```

**¿Cuál elegir?**
- La mayoría de los teléfonos Android modernos (2017+) usan **arm64-v8a**.
- Si el dispositivo es muy antiguo o tienes dudas, usa el **APK universal**.
- Te recomendamos generar el APK **arm64-v8a** que es el más pequeño y compatible con dispositivos actuales.

#### Opción 4: Build con Gradle directamente (avanzado)

Para personalizar aún más el build, puedes editar `android/app/build.gradle` antes de compilar:

```gradle
android {
  defaultConfig {
    // ...
  }
  splits {
    abi {
      enable true
      reset()
      include "arm64-v8a", "armeabi-v7a", "x86_64"
      universalApk true
    }
  }
}
```

### Configurar Supabase (para sincronización en la nube)

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** → **New Query**
3. Copiar y pegar el script SQL completo de la sección **[Especificación Técnica → Apéndice: Script SQL para Supabase](especificacion_tecnica_v3.md#ap%C3%A9ndice-script-sql-para-supabase)**
4. Ejecutar el script (crea todas las tablas, índices, RLS y triggers automáticamente)
5. Ir a **Authentication** → **Users** → **Add User** y crear el usuario `admin@negocio.com`
6. En la app, ir a **Configuración** → **Conexión a la Nube** e ingresar:
   - URL del proyecto (Settings → API → Project URL)
   - Anon Key (Settings → API → anon public)
   - Email: `admin@negocio.com`
   - Contraseña: la que configuraste en el paso 5

---

## 📁 Estructura del Proyecto

```
POS-CopyCenter/
├── App.js                      # Punto de entrada
├── app.json                    # Configuración de Expo
├── babel.config.js             # Configuración de Babel
├── src/
│   ├── components/             # Componentes UI reutilizables
│   │   ├── NumPad.jsx          # Teclado numérico del POS
│   │   ├── ProductButton.jsx   # Botón de producto con animación
│   │   ├── CartItem.jsx        # Línea del carrito
│   │   └── ...
│   ├── context/                # Contextos de React
│   │   ├── DbContext.jsx       # Inicialización de SQLite
│   │   ├── VentaContext.jsx    # Estado de la venta activa
│   │   ├── SyncContext.jsx     # Estado de sincronización
│   │   └── ConfigContext.jsx   # Configuración persistente
│   ├── hooks/                  # Hooks personalizados
│   │   ├── useCarrito.js       # Lógica del carrito de compras
│   │   └── __tests__/          # Tests unitarios
│   ├── database/               # Capa de datos
│   │   ├── schema.js           # Esquema de tablas SQLite
│   │   ├── migrations.js       # Migraciones atómicas
│   │   ├── seed.js             # Datos iniciales
│   │   └── queries/            # Queries SQL organizadas
│   ├── services/               # Servicios (Sync, Auth, PDF, etc.)
│   ├── screens/                # Pantallas de la app
│   └── utils/                  # Utilidades (responsive, etc.)
```

---

## 🧪 Tests

```bash
# Ejecutar todos los tests
npm test

# Con coverage
npx jest --coverage

# Modo watch
npx jest --watch
```

---

## 🛠️ Tareas de Desarrollo

```bash
# Linter
npm run lint

# Formatear código
npm run format
```

---

## 🤝 Contribuir

Si este proyecto te es útil o quieres mejorarlo, eres bienvenido. Algunas ideas de mejora:

- [ ] Soporte para tablets con layout adaptativo
- [ ] Exportar reportes a Excel
- [ ] Modo oscuro
- [ ] Múltiples usuarios/roles
- [ ] Backup automático programado
- [ ] Notificaciones de deuda vía WhatsApp

---

## 📄 Licencia

MIT — Usa este código libremente, aprende de él, mejóralo. Si te sirve, comparte el proyecto con alguien más que pueda necesitarlo.

---

*Hecho con ❤️ para mi mamá y para todos los que llevan cuentas en un cuaderno.*
