import CustomText from './CustomText';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet, TouchableOpacity, ActivityIndicator, Alert, View
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../services/authService';
import COLORS from '../constants/colors';

/**
 * Banner no bloqueante que se muestra si hay red activa pero la sesión con Supabase expiró.
 */
export default function ReconnectBanner() {
  const { sessionActiva, reauthenticate, isReconnecting } = useAuth();
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  // Solo se muestra si hay internet y la sesión NO está activa
  if (!isConnected || sessionActiva) {
    return null;
  }

  const handlePress = async () => {
    try {
      await reauthenticate();
    } catch (e) {
      Alert.alert(
        'Sin conexión',
        'No se pudo reconectar con Supabase. El respaldo se reanudará automáticamente cuando haya internet.'
      );
    }
  };

  return (
    <TouchableOpacity
      style={styles.banner}
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={isReconnecting}
    >
      <View style={styles.content}>
        <CustomText style={styles.text}>
          {isReconnecting ? 'Reconectando respaldo...' : 'Respaldo en pausa — Toca para reconectar'}
        </CustomText>
        {isReconnecting && (
          <ActivityIndicator size="small" color="#fff" style={styles.loader} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.batchNaranja,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loader: {
    marginLeft: 8,
  },
});
