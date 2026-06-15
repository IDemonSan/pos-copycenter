import CustomText from '../components/CustomText';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useDb } from '../context/DbContext';
import { subirDatosPendientes, descargarDatosNube } from '../services/syncService';
import { exportarBackup, importarBackup } from '../services/backupService';
import { supabase } from '../services/supabaseClient';
import COLORS from '../constants/colors';
import { useSync } from '../context/SyncContext';
import { useConfig } from '../context/ConfigContext';

export default function ConfigScreen() {
  const { db } = useDb();
  const { actualizarConteo } = useSync();
  const { mostrarEtiquetasMenu, setMostrarEtiquetasMenu } = useConfig();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [turnoActivo, setTurnoActivo] = useState('Mañana');
  const [ultimoBackup, setUltimoBackup] = useState('Nunca');
  const [isBackupLoading, setIsBackupLoading] = useState(false);

  const handleSyncNube = async () => {
    if (!supabase) {
      Alert.alert(
        'Configuración Requerida',
        'Por favor, configura primero la conexión a la nube (Supabase) en los ajustes generales para poder sincronizar.'
      );
      return;
    }

    setIsBackupLoading(true);
    try {
      const subidaStats = await subirDatosPendientes(db);
      const descargaStats = await descargarDatosNube(db);

      const nowStr = new Date().toLocaleString();
      await db.runAsync(
        "UPDATE app_config SET value = ? WHERE key = 'ultimo_backup';",
        [nowStr]
      );
      setUltimoBackup(nowStr);

      await loadData();
      await actualizarConteo();

      Alert.alert(
        'Sincronización Completada',
        `Respaldo e integración bidireccional exitosa.\n\n` +
        `Subida (Nube):\n` +
        `• ${subidaStats.productos} productos subidos.\n` +
        `• ${subidaStats.ventas} ventas subidas.\n\n` +
        `Descarga (Celular):\n` +
        `• ${descargaStats.productos.creados + descargaStats.productos.actualizados} productos integrados (${descargaStats.productos.creados} nuevos, ${descargaStats.productos.actualizados} actualizados).\n` +
        `• ${descargaStats.ventas.creados + descargaStats.ventas.actualizados} ventas integradas (${descargaStats.ventas.creados} nuevas, ${descargaStats.ventas.actualizados} actualizadas).`
      );
    } catch (error) {
      console.error('[Config] Error al sincronizar con la nube:', error);
      Alert.alert('Error de Sincronización', error.message || 'Ocurrió un error inesperado al conectar con Supabase.');
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleExportarJSON = async () => {
    setIsBackupLoading(true);
    try {
      const fecha = await exportarBackup(db);
      const nowStr = new Date().toLocaleString();
      setUltimoBackup(nowStr);
      Alert.alert('Copia de Seguridad Exportada', `El archivo de copia local se ha generado y compartido exitosamente (${fecha}).`);
    } catch (error) {
      console.error('[Config] Error al exportar JSON:', error);
      Alert.alert('Error', 'No se pudo exportar el archivo de copia local.');
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleImportarJSON = async () => {
    setIsBackupLoading(true);
    try {
      const res = await importarBackup(db);
      if (res) {
        setUltimoBackup(res.fecha);
        await loadData();
        await actualizarConteo();
        Alert.alert(
          'Restauración Exitosa',
          `Se han integrado correctamente todos los registros:\n\n` +
          `• Productos: ${res.productos}\n` +
          `• Ventas: ${res.ventas}\n` +
          `• Detalles de venta: ${res.detalles}`
        );
      }
    } catch (error) {
      console.error('[Config] Error al importar JSON:', error);
      Alert.alert('Error de Restauración', error.message || 'No se pudo restaurar la base de datos a partir del archivo seleccionado.');
    } finally {
      setIsBackupLoading(false);
    }
  };

  const loadData = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const turnoRes = await db.getFirstAsync(
        "SELECT value FROM app_config WHERE key = 'turno_activo';"
      );
      if (turnoRes && turnoRes.value) {
        setTurnoActivo(turnoRes.value);
      }

      const backupRes = await db.getFirstAsync(
        "SELECT value FROM app_config WHERE key = 'ultimo_backup';"
      );
      if (backupRes && backupRes.value) {
        setUltimoBackup(backupRes.value);
      } else {
        setUltimoBackup('Nunca');
      }
    } catch (err) {
      console.error('[Config] Error al cargar configuración:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, db]);

  const handleToggleTurno = async (nuevoTurno) => {
    try {
      await db.runAsync(
        "UPDATE app_config SET value = ? WHERE key = 'turno_activo';",
        [nuevoTurno]
      );
      setTurnoActivo(nuevoTurno);
    } catch (err) {
      console.error('[Config] Error al guardar turno en DB:', err);
      Alert.alert('Error', 'No se pudo guardar el turno.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* SECCIÓN 1: AJUSTES GENERALES */}
        <View style={styles.sectionCard}>
          <CustomText style={styles.sectionTitle}>Ajustes Generales</CustomText>

          <View style={styles.settingRow}>
            <CustomText style={styles.settingLabel}>Turno activo:</CustomText>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  turnoActivo === 'Mañana' && styles.toggleBtnActive,
                ]}
                activeOpacity={0.7}
                onPress={() => handleToggleTurno('Mañana')}
              >
                <CustomText
                  style={[
                    styles.toggleText,
                    turnoActivo === 'Mañana' && styles.toggleTextActive,
                  ]}
                >
                  Mañana
                </CustomText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  turnoActivo === 'Tarde' && styles.toggleBtnActive,
                ]}
                activeOpacity={0.7}
                onPress={() => handleToggleTurno('Tarde')}
              >
                <CustomText
                  style={[
                    styles.toggleText,
                    turnoActivo === 'Tarde' && styles.toggleTextActive,
                  ]}
                >
                  Tarde
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.settingRow, { marginTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 }]}>
            <CustomText style={styles.settingLabel}>Mostrar textos en menú:</CustomText>
            <Switch
              value={mostrarEtiquetasMenu}
              onValueChange={setMostrarEtiquetasMenu}
              trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
              thumbColor={mostrarEtiquetasMenu ? '#fff' : '#f3f4f6'}
            />
          </View>

          <View style={[styles.settingRow, { marginTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 }]}>
            <CustomText style={styles.settingLabel}>Medios de Pago (QR):</CustomText>
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('MediosPago')}
            >
              <CustomText style={styles.actionBtnText}>Configurar →</CustomText>
            </TouchableOpacity>
          </View>

          <View style={[styles.settingRow, { marginTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 }]}>
            <CustomText style={styles.settingLabel}>Conexión Nube (Supabase):</CustomText>
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('SupabaseConfig')}
            >
              <CustomText style={styles.actionBtnText}>Configurar →</CustomText>
            </TouchableOpacity>
          </View>

          {/* Catálogo de Productos como menú independiente */}
          <View style={[styles.settingRow, { marginTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 }]}>
            <CustomText style={styles.settingLabel}>Catálogo de Productos:</CustomText>
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ProductosList')}
            >
              <CustomText style={styles.actionBtnText}>Configurar →</CustomText>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECCIÓN 2: RESPALDO MANUAL */}
        <View style={styles.sectionCard}>
          <CustomText style={styles.sectionTitle}>Copias de Seguridad</CustomText>

          {/* Nube */}
          <View style={{ marginBottom: 16 }}>
            <CustomText style={styles.backupSubTitle}>Sincronización en la Nube (Online)</CustomText>
            <CustomText style={styles.backupNoticeText}>
              Respalda y recupera tus ventas y catálogo al instante sincronizando de forma bidireccional con Supabase.
            </CustomText>
            <TouchableOpacity
              style={[styles.primaryBackupBtn, isBackupLoading && styles.backupBtnDisabled]}
              disabled={isBackupLoading}
              activeOpacity={0.8}
              onPress={handleSyncNube}
            >
              <CustomText style={styles.primaryBackupBtnText}>Sincronizar con la Nube</CustomText>
            </TouchableOpacity>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: COLORS.borde, marginVertical: 12 }} />

          {/* Local JSON */}
          <View>
            <CustomText style={styles.backupSubTitle}>Respaldo Local Offline (JSON)</CustomText>
            <CustomText style={styles.backupNoticeText}>
              Guarda o recupera un archivo de texto encriptado en el almacenamiento del dispositivo.
            </CustomText>
            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={[styles.secondaryBackupBtn, { marginRight: 8 }, isBackupLoading && styles.backupBtnDisabled]}
                disabled={isBackupLoading}
                activeOpacity={0.8}
                onPress={handleExportarJSON}
              >
                <CustomText style={styles.secondaryBackupBtnText}>Exportar JSON</CustomText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryBackupBtn, isBackupLoading && styles.backupBtnDisabled]}
                disabled={isBackupLoading}
                activeOpacity={0.8}
                onPress={handleImportarJSON}
              >
                <CustomText style={styles.secondaryBackupBtnText}>Importar JSON</CustomText>
              </TouchableOpacity>
            </View>
          </View>

          {isBackupLoading && (
            <View style={styles.overlayLoading}>
              <ActivityIndicator size="small" color="#059669" />
              <CustomText style={styles.overlayText}>Procesando copia de seguridad...</CustomText>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.fondoPantalla,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borde,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textoSecundario,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontSize: 16,
    color: COLORS.textoPrimario,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  toggleText: {
    fontSize: 14,
    color: COLORS.textoSecundario,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#3b82f6',
  },
  backupSubTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
    marginBottom: 4,
  },
  backupNoticeText: {
    fontSize: 12,
    color: COLORS.textoSecundario,
    marginBottom: 10,
    lineHeight: 16,
  },
  primaryBackupBtn: {
    height: 44,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryBackupBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  rowButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secondaryBackupBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: COLORS.borde,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBackupBtnText: {
    color: COLORS.textoPrimario,
    fontWeight: '600',
    fontSize: 13,
  },
  backupBtnDisabled: {
    opacity: 0.5,
  },
  overlayLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    backgroundColor: '#ecfdf5',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  overlayText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: 'bold',
    color: '#065f46',
  },
  actionBtn: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  actionBtnText: {
    color: '#1d4ed8',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
