import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPendientesCount, setSyncCallback } from '../services/syncWorker';

/**
 * Ícono indicador de sincronización en el header.
 */
export default function SyncStatusIcon() {
  const [pendientes, setPendientes] = useState(getPendientesCount());

  useEffect(() => {
    // Suscribirse a actualizaciones del SyncWorker
    setSyncCallback((count) => {
      setPendientes(count);
    });
  }, []);

  const handlePress = () => {
    if (pendientes === 0) {
      Alert.alert('Sincronización', 'Todo está respaldado en la nube ✓');
    } else {
      Alert.alert(
        'Sincronización',
        `${pendientes} ${
          pendientes === 1 ? 'registro pendiente' : 'registros pendientes'
        } de respaldo. Se sincronizarán cuando haya WiFi.`
      );
    }
  };

  const isPending = pendientes > 0;

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={handlePress}
    >
      <Ionicons
        name={isPending ? 'cloud' : 'cloud-outline'}
        size={24}
        color={isPending ? '#ea580c' : '#9ca3af'}
      />
      {isPending && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {pendientes > 99 ? '99+' : pendientes}
          </Text>
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
