import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const ConfigContext = createContext({
  mostrarEtiquetasMenu: true,
  setMostrarEtiquetasMenu: () => {},
  mostrarBannerReconexion: true,
  setMostrarBannerReconexion: () => {},
});

export function useConfig() {
  return useContext(ConfigContext);
}

export function ConfigProvider({ children }) {
  const [mostrarEtiquetasMenu, setMostrarEtiquetasMenuState] = useState(true);
  const [mostrarBannerReconexion, setMostrarBannerReconexionState] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      try {
        const value = await SecureStore.getItemAsync('mostrarEtiquetasMenu');
        if (value !== null) {
          setMostrarEtiquetasMenuState(value === 'true');
        }
        const bannerValue = await SecureStore.getItemAsync('mostrarBannerReconexion');
        if (bannerValue !== null) {
          setMostrarBannerReconexionState(bannerValue === 'true');
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

  const setMostrarBannerReconexion = async (value) => {
    try {
      setMostrarBannerReconexionState(value);
      await SecureStore.setItemAsync('mostrarBannerReconexion', String(value));
    } catch (err) {
      console.warn('[ConfigContext] Error al guardar configuración:', err);
    }
  };

  return (
    <ConfigContext.Provider value={{ mostrarEtiquetasMenu, setMostrarEtiquetasMenu, mostrarBannerReconexion, setMostrarBannerReconexion }}>
      {children}
    </ConfigContext.Provider>
  );
}
