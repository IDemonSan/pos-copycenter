import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { Alert } from 'react-native';

// Adaptador de almacenamiento para que Supabase use SecureStore en lugar de localStorage
const ExpoSecureStoreAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export let supabase = null;
export let authErrorState = null; // 'credentials_error', 'network_error', o null

export function setAuthErrorState(val) {
  authErrorState = val;
}

/**
 * Inicializa la instancia del cliente de Supabase leyendo las credenciales guardadas en SecureStore.
 * Si no existen, retorna null de forma segura permitiendo el modo offline local.
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient | null>}
 */
export async function inicializarSupabase() {
  try {
    const url = await SecureStore.getItemAsync('supabase_url');
    const anonKey = await SecureStore.getItemAsync('supabase_anon_key');

    if (url && anonKey) {
      supabase = createClient(url, anonKey, {
        auth: {
          storage: ExpoSecureStoreAdapter,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });
      console.log('[Supabase Client] Inicializado dinámicamente con credenciales de SecureStore.');
      return supabase;
    } else {
      supabase = null;
      console.log('[Supabase Client] No se inicializó (sin credenciales de red guardadas).');
      return null;
    }
  } catch (error) {
    console.error('[Supabase Client] Error al inicializar cliente de Supabase:', error);
    supabase = null;
    return null;
  }
}

/**
 * Asegura que la sesión de Supabase esté activa mediante un login automático
 * usando las credenciales guardadas en SecureStore.
 * @returns {Promise<boolean>}
 */
export async function asegurarAutenticacion() {
  if (!supabase) return false;
  if (authErrorState === 'credentials_error') {
    return false;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      authErrorState = null;
      return true;
    }

    const email = await SecureStore.getItemAsync('supabase_user_email');
    const password = await SecureStore.getItemAsync('supabase_user_password');

    if (email && password) {
      console.log('[Supabase Client] Intentando inicio de sesión automático...');
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.warn('[Supabase Client] Error al iniciar sesión automático:', error.message);
        if (error.status === 400 || error.message.includes("Invalid login credentials")) {
          authErrorState = 'credentials_error';
          Alert.alert(
            "Error de Conexión a la Nube",
            "Las credenciales ingresadas no apuntan a ningún usuario válido en Supabase. Revisa el correo y la contraseña en Configuración.",
            [{ text: "OK" }]
          );
        } else {
          authErrorState = 'network_error';
        }
        return false;
      }

      console.log('[Supabase Client] Inicio de sesión automático exitoso.');
      authErrorState = null;
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Supabase Client] Error al asegurar autenticación:', error);
    authErrorState = 'network_error';
    return false;
  }
}

export default () => supabase;
