import CustomText from '../components/CustomText';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { inicializarSupabase, setAuthErrorState } from '../services/supabaseClient';
import { initSession } from '../services/authService';
import COLORS from '../constants/colors';

export default function SupabaseConfigScreen() {
  const navigation = useNavigation();

  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [supabaseUserEmail, setSupabaseUserEmail] = useState('');
  const [supabaseUserPassword, setSupabaseUserPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Cargar credenciales al montar la pantalla
  useEffect(() => {
    async function cargarCredenciales() {
      try {
        const savedUrl = await SecureStore.getItemAsync('supabase_url');
        const savedKey = await SecureStore.getItemAsync('supabase_anon_key');
        const savedEmail = await SecureStore.getItemAsync('supabase_user_email');
        const savedPassword = await SecureStore.getItemAsync('supabase_user_password');
        if (savedUrl) setSupabaseUrl(savedUrl);
        if (savedKey) setSupabaseAnonKey(savedKey);
        if (savedEmail) setSupabaseUserEmail(savedEmail);
        if (savedPassword) setSupabaseUserPassword(savedPassword);
      } catch (error) {
        console.error('[SupabaseConfig] Error al cargar credenciales:', error);
      } finally {
        setLoading(false);
      }
    }
    cargarCredenciales();
  }, []);

  const handleSave = async () => {
    const urlTrimmed = supabaseUrl.trim();
    const keyTrimmed = supabaseAnonKey.trim();
    const emailTrimmed = supabaseUserEmail.trim();
    const passwordTrimmed = supabaseUserPassword.trim();

    if (!urlTrimmed || !keyTrimmed || !emailTrimmed || !passwordTrimmed) {
      Alert.alert('Faltan datos', 'Por favor ingresa todos los campos obligatorios del formulario.');
      return;
    }

    setGuardando(true);
    try {
      await SecureStore.setItemAsync('supabase_url', urlTrimmed);
      await SecureStore.setItemAsync('supabase_anon_key', keyTrimmed);
      await SecureStore.setItemAsync('supabase_user_email', emailTrimmed);
      await SecureStore.setItemAsync('supabase_user_password', passwordTrimmed);

      // Limpiar caché de errores anteriores antes de intentar iniciar sesión de nuevo
      setAuthErrorState(null);

      // Reinicializar Supabase y re-autenticar de inmediato
      await inicializarSupabase();
      await initSession();

      Alert.alert(
        'Conexión configurada',
        'Las credenciales de Supabase se han guardado de forma segura y se han aplicado a los servicios de red.',
        [
          {
            text: 'Aceptar',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('[SupabaseConfig] Error al guardar credenciales:', error);
      Alert.alert('Error', 'No se pudieron almacenar las credenciales de Supabase.');
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <CustomText style={styles.loadingText}>Cargando credenciales...</CustomText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <CustomText style={styles.title}>Conexión con la Nube</CustomText>
          <CustomText style={styles.subtitle}>
            Configura las credenciales de tu proyecto de Supabase para activar la sincronización y el respaldo automático de ventas en segundo plano.
          </CustomText>

          <CustomText style={styles.label}>URL del Proyecto Supabase *</CustomText>
          <TextInput
            style={styles.input}
            placeholder="https://xxxxxxxxxxxx.supabase.co"
            value={supabaseUrl}
            onChangeText={setSupabaseUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <CustomText style={[styles.label, { marginTop: 12 }]}>Anon Key de Supabase *</CustomText>
          <TextInput
            style={styles.input}
            placeholder="eyJxxxxxxxxxxxx..."
            secureTextEntry={true}
            value={supabaseAnonKey}
            onChangeText={setSupabaseAnonKey}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={{ marginVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.borde, paddingTop: 16 }}>
            <CustomText style={[styles.title, { fontSize: 16 }]}>Credenciales del Administrador</CustomText>
            <CustomText style={[styles.subtitle, { marginBottom: 12 }]}>
              Ingresa el correo y la contraseña de la cuenta autorizada creada en Supabase Auth.
            </CustomText>

            <CustomText style={styles.label}>Correo electrónico *</CustomText>
            <TextInput
              style={styles.input}
              placeholder="admin@negocio.com"
              keyboardType="email-address"
              value={supabaseUserEmail}
              onChangeText={setSupabaseUserEmail}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <CustomText style={[styles.label, { marginTop: 12 }]}>Contraseña *</CustomText>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              secureTextEntry={true}
              value={supabaseUserPassword}
              onChangeText={setSupabaseUserPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, guardando && styles.saveButtonDisabled]}
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={guardando}
          >
            {guardando ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <CustomText style={styles.saveButtonText}>Guardar Conexión</CustomText>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.fondoPantalla,
  },
  container: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.textoSecundario,
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.borde,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textoSecundario,
    lineHeight: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.textoSecundario,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    height: 48,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: COLORS.borde,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: COLORS.textoPrimario,
    marginBottom: 16,
  },
  saveButton: {
    height: 48,
    backgroundColor: '#10b981',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
