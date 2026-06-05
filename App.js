import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { DbProvider, useDb } from './src/context/DbContext';
import { VentaProvider } from './src/context/VentaContext';
import { AuthProvider, initSession } from './src/services/authService';
import { initSyncWorker } from './src/services/syncWorker';
import { SyncProvider } from './src/context/SyncContext';
import AppNavigator from './src/navigation/AppNavigator';
import * as NavigationBar from 'expo-navigation-bar';


/**
 * Valida la inicialización de la base de datos y monta el AppNavigator.
 */
function AppContent() {
  const { db, isReady, error } = useDb();

  // Configurar modo inmersivo en Android (ocultar botones de navegación nativos)
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('sticky-immersive');
    }
  }, []);

  useEffect(() => {
    if (isReady && db) {
      initSession()
        .then(() => {
          initSyncWorker(db);
        })
        .catch((err) => {
          console.warn('[App] Error al inicializar la sesión de Supabase:', err);
        });
    }
  }, [isReady, db]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error al inicializar la base de datos:</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Inicializando base de datos...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <VentaProvider db={db}>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </VentaProvider>
  );
}

/**
 * Punto de entrada principal de la aplicación.
 */
export default function App() {
  return (
    <DbProvider>
      <AuthProvider>
        <SyncProvider>
          <AppContent />
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
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  errorMessage: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
});
