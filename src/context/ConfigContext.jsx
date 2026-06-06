import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const ConfigContext = createContext({
  mostrarEtiquetasMenu: true,
  setMostrarEtiquetasMenu: () => {},
});

export function useConfig() {
  return useContext(ConfigContext);
}

export function ConfigProvider({ children }) {
  const [mostrarEtiquetasMenu, setMostrarEtiquetasMenuState] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      try {
        const value = await SecureStore.getItemAsync('mostrarEtiquetasMenu');
        if (value !== null) {
          setMostrarEtiquetasMenuState(value === 'true');
        }
      } catch (err) {
        console.warn('[ConfigContext] Error al cargar configuración:', err);
      }
    }
    loadConfig();
  }, []);

  const setMostrarEtiquetasMenu = async (value) => {
    try {
      setMostrarEtiquetasMenuState(value);
      await SecureStore.setItemAsync('mostrarEtiquetasMenu', String(value));
    } catch (err) {
      console.warn('[ConfigContext] Error al guardar configuración:', err);
    }
  };

  return (
    <ConfigContext.Provider value={{ mostrarEtiquetasMenu, setMostrarEtiquetasMenu }}>
      {children}
    </ConfigContext.Provider>
  );
}
