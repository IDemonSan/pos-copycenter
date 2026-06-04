import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase, authErrorState, setAuthErrorState } from './supabaseClient';
import { Alert } from 'react-native';

const AuthContext = createContext({
  sessionActiva: false,
  reauthenticate: async () => {},
  isReconnecting: false,
});

/**
 * Hook personalizado para consumir el estado de autenticación de Supabase.
 */
export function useAuth() {
  return useContext(AuthContext);
}

// Variable global expuesta para servicios que corren fuera de React (ej: syncWorker)
export let sessionActiva = false;

/**
 * Re-autentica de forma asíncrona la cuenta admin fija en Supabase.
 */
export async function reauthenticate() {
  if (!supabase) {
    sessionActiva = false;
    return false;
  }
  if (authErrorState === 'credentials_error') {
    sessionActiva = false;
    return false;
  }
  try {
    const email = await SecureStore.getItemAsync('supabase_user_email');
    const password = await SecureStore.getItemAsync('supabase_user_password');

    if (!email || !password) {
      console.warn('[Auth] Credenciales de autenticación incompletas en SecureStore. Sincronización inactiva.');
      sessionActiva = false;
      return false;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.warn('[Auth] Login fallido — modo offline completo:', error.message);
      sessionActiva = false;
      if (error.status === 400 || error.message.includes("Invalid login credentials")) {
        setAuthErrorState('credentials_error');
        Alert.alert(
          "Error de Conexión a la Nube",
          "Las credenciales ingresadas no apuntan a ningún usuario válido en Supabase. Revisa el correo y la contraseña en Configuración.",
          [{ text: "OK" }]
        );
      } else {
        setAuthErrorState('network_error');
      }
      return false;
    }

    setAuthErrorState(null);
    sessionActiva = true;
    return true;
  } catch (e) {
    console.warn('[Auth] Error de red al autenticar:', e.message);
    sessionActiva = false;
    setAuthErrorState('network_error');
    return false;
  }
}

/**
 * Inicializa la sesión de Supabase leyendo la persistencia inicial.
 */
export async function initSession() {
  if (!supabase) {
    sessionActiva = false;
    return;
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      sessionActiva = true;
    } else {
      await reauthenticate();
    }
  } catch (e) {
    console.warn('[Auth] No se pudo verificar la sesión inicial:', e.message);
    sessionActiva = false;
  }

  // Listener global de estado de auth
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      sessionActiva = true;
    }
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_FAILED') {
      sessionActiva = false;
    }
  });
}

/**
 * Proveedor de estado de sesión para la interfaz de React.
 */
export function AuthProvider({ children }) {
  const [sessionActivaState, setSessionActivaState] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const triggerReauth = async () => {
    setIsReconnecting(true);
    const success = await reauthenticate();
    setSessionActivaState(success);
    setIsReconnecting(false);
    if (!success) {
      throw new Error('Falló la re-autenticación');
    }
  };

  useEffect(() => {
    if (!supabase) {
      setSessionActivaState(false);
      sessionActiva = false;
      return;
    }

    // Sincronizar el estado de React con la suscripción de Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const active = !!session;
      setSessionActivaState(active);
      sessionActiva = active;
    });

    // Cargar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      const active = !!session;
      setSessionActivaState(active);
      sessionActiva = active;
    }).catch(err => {
      console.warn('[Auth Provider] Error al leer sesión inicial:', err);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        sessionActiva: sessionActivaState,
        reauthenticate: triggerReauth,
        isReconnecting,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
