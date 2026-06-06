import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Platform, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { DbProvider, useDb } from './src/context/DbContext';
import { VentaProvider } from './src/context/VentaContext';
import { AuthProvider, initSession } from './src/services/authService';
import { initSyncWorker } from './src/services/syncWorker';
import { SyncProvider } from './src/context/SyncContext';
import AppNavigator from './src/navigation/AppNavigator';
import * as NavigationBar from 'expo-navigation-bar';
import { setStatusBarHidden } from 'expo-status-bar'; // ← usa esto en vez de StatusBar de RN
import { ConfigProvider } from './src/context/ConfigContext';


// ✅ Hook que detecta si la barra vuelve a aparecer y la re-oculta automáticamente
function useStickyImmersive() {
  const visibility = NavigationBar.useVisibility();

  useEffect(() => {
    if (visibility === 'visible') {
      const timer = setTimeout(() => {
        NavigationBar.setVisibilityAsync('hidden');
      }, 800); // 800ms: más rápido que los 3s por defecto, ajusta a tu gusto
      return () => clearTimeout(timer);
    }
  }, [visibility]);
}


async function ocultarBarras() {
  try {
    if (Platform.OS === 'android') {
      // ✅ Orden correcto: position → behavior → visibility
      await NavigationBar.setPositionAsync('absolute');
      await NavigationBar.setBackgroundColorAsync('#00000000');
      await NavigationBar.setBehaviorAsync('overlay-swipe'); // aparece al deslizar desde el borde 'overlay-swipe'
      await NavigationBar.setVisibilityAsync('hidden');
    }
    setStatusBarHidden(true, 'none'); // ← más confiable que StatusBar.setHidden()
  } catch (err) {
    console.warn('[Immersive] Error:', err);
  }
}


function AppContent() {
  const { db, isReady, error } = useDb();

  // ✅ Hook reactivo: re-oculta la barra cada vez que reaparece
  useStickyImmersive();

  useEffect(() => {
    if (isReady) {
      ocultarBarras();
    }

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isReady) {
        ocultarBarras();
      }
    });

    return () => subscription?.remove();
  }, [isReady]);

  useEffect(() => {
    if (isReady && db) {
      initSession()
        .then(() => initSyncWorker(db))
        .catch((err) => {
          console.warn('[App] Error al inicializar sesión:', err);
        });
    }
  }, [isReady, db]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error al inicializar la base de datos:</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Inicializando base de datos...</Text>
      </View>
    );
  }

  return (
    <VentaProvider db={db}>
      <NavigationContainer onReady={ocultarBarras}>
        <AppNavigator />
      </NavigationContainer>
    </VentaProvider>
  );
}


export default function App() {
  return (
    <DbProvider>
      <AuthProvider>
        <SyncProvider>
          <ConfigProvider>
            <AppContent />
          </ConfigProvider>
        </SyncProvider>
      </AuthProvider>
    </DbProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  errorText: { fontSize: 18, color: 'red', fontWeight: 'bold', marginBottom: 5 },
  errorMessage: { fontSize: 14, color: '#333', textAlign: 'center' },
});