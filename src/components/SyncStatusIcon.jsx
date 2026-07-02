import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../context/SyncContext';
import { authErrorState } from '../services/supabaseClient';

/**
 * Ícono indicador de sincronización en el header con soporte para Sincronización Rápida Global.
 */
export default function SyncStatusIcon() {
  const { pendientesCount, isSyncing, ejecutarSincronizacion } = useSync();
  const [mostrarCheck, setMostrarCheck] = useState(false);

  const handlePress = async () => {
    if (isSyncing) return;

    await ejecutarSincronizacion();

    if (authErrorState !== 'credentials_error') {
      setMostrarCheck(true);
      setTimeout(() => {
        setMostrarCheck(false);
      }, 1500);
    }
  };

  const isPending = pendientesCount > 0;
  const hasAuthError = authErrorState === 'credentials_error';

  if (isSyncing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#10b981" />
      </View>
    );
  }

  if (mostrarCheck) {
    return (
      <View style={styles.container}>
        <Ionicons name="checkmark-circle" size={24} color="#10b981" />
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.7} onPress={handlePress}>
      <Ionicons
        name={hasAuthError ? 'cloud-offline' : isPending ? 'cloud' : 'cloud-outline'}
        size={24}
        color={hasAuthError ? '#ef4444' : isPending ? '#ea580c' : '#9ca3af'}
      />
      {isPending && !hasAuthError && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendientesCount > 99 ? '99+' : pendientesCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 16,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ea580c',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
