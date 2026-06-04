import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useDb } from '../context/DbContext';
import { getTodosLosProductos, intercambiarOrden } from '../database/queries/productos';
import { subirDatosPendientes, descargarDatosNube } from '../services/syncService';
import { exportarBackup, importarBackup } from '../services/backupService';
import { supabase } from '../services/supabaseClient';
import COLORS from '../constants/colors';
import { useSync } from '../context/SyncContext';

export default function ConfigScreen() {
  const { db } = useDb();
  const { actualizarConteo } = useSync();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState([]);
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
      // 1. Ejecutar subida de datos pendientes
      const subidaStats = await subirDatosPendientes(db);

      // 2. Ejecutar descarga/sincronización de datos nuevos de la nube
      const descargaStats = await descargarDatosNube(db);

      // 3. Registrar fecha y hora del último respaldo localmente
      const nowStr = new Date().toLocaleString();
      await db.runAsync(
        "UPDATE app_config SET value = ? WHERE key = 'ultimo_backup';",
        [nowStr]
      );
      setUltimoBackup(nowStr);

      // 4. Recargar datos de la pantalla para mostrar cambios (ej: nuevos productos)
      await loadData();
      
      // 5. Actualizar conteo global en el header
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
      // 1. Cargar catálogo de productos
      const prodList = await getTodosLosProductos(db);
      setProductos(prodList);

      // 2. Cargar turno activo de app_config
      const turnoRes = await db.getFirstAsync(
        "SELECT value FROM app_config WHERE key = 'turno_activo';"
      );
      if (turnoRes && turnoRes.value) {
        setTurnoActivo(turnoRes.value);
      }

      // 3. Cargar último backup de app_config
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

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const itemA = productos[index];
    const itemB = productos[index - 1];

    try {
      await intercambiarOrden(db, {
        idA: itemA.id,
        ordenA: itemB.orden_prioridad,
        idB: itemB.id,
        ordenB: itemA.orden_prioridad,
      });
      loadData();
    } catch (err) {
      Alert.alert('Error', 'No se pudo cambiar el orden de los productos.');
    }
  };

  const handleMoveDown = async (index) => {
    if (index === productos.length - 1) return;
    const itemA = productos[index];
    const itemB = productos[index + 1];

    try {
      await intercambiarOrden(db, {
        idA: itemA.id,
        ordenA: itemB.orden_prioridad,
        idB: itemB.id,
        ordenB: itemA.orden_prioridad,
      });
      loadData();
    } catch (err) {
      Alert.alert('Error', 'No se pudo cambiar el orden de los productos.');
    }
  };

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

  const renderProductItem = ({ item, index }) => {
    const isFirst = index === 0;
    const isLast = index === productos.length - 1;
    const displayPrice =
      item.is_custom === 1
        ? 'Caso especial'
        : item.is_variable === 1
          ? 'Precio variable'
          : `S/ ${(item.precio_cents / 100).toFixed(2)}`;

    return (
      <View style={styles.productRow}>
        {/* Reordenar */}
        <View style={styles.orderButtons}>
          <TouchableOpacity
            style={[styles.arrowBtn, isFirst && styles.arrowBtnDisabled]}
            disabled={isFirst}
            activeOpacity={0.7}
            onPress={() => handleMoveUp(index)}
          >
            <Text style={[styles.arrowText, isFirst && styles.arrowTextDisabled]}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrowBtn, isLast && styles.arrowBtnDisabled]}
            disabled={isLast}
            activeOpacity={0.7}
            onPress={() => handleMoveDown(index)}
          >
            <Text style={[styles.arrowText, isLast && styles.arrowTextDisabled]}>↓</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.nombre}</Text>
          <View style={styles.productSubRow}>
            <Text style={styles.productPrice}>{displayPrice}</Text>
            <Text style={styles.bullet}>•</Text>
            {item.activo === 1 ? (
              <Text style={[styles.statusText, styles.statusActive]}>Activo ●</Text>
            ) : (
              <Text style={[styles.statusText, styles.statusInactive]}>Inactivo ○</Text>
            )}
          </View>
        </View>

        {/* Editar */}
        <TouchableOpacity
          style={styles.editBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ProductoEdit', { producto: item })}
        >
          <Text style={styles.editIcon}>✏️</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={productos}
        keyExtractor={(item) => item.id}
        renderItem={renderProductItem}
        contentContainerStyle={styles.scrollContainer}
        ListHeaderComponent={
          <>
            {/* SECCIÓN 2: AJUSTES GENERALES */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Ajustes Generales</Text>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Turno activo:</Text>
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      turnoActivo === 'Mañana' && styles.toggleBtnActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleToggleTurno('Mañana')}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        turnoActivo === 'Mañana' && styles.toggleTextActive,
                      ]}
                    >
                      Mañana
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      turnoActivo === 'Tarde' && styles.toggleBtnActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleToggleTurno('Tarde')}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        turnoActivo === 'Tarde' && styles.toggleTextActive,
                      ]}
                    >
                      Tarde
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.settingRow, { marginTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 }]}>
                <Text style={styles.settingLabel}>Medios de Pago (QR):</Text>
                <TouchableOpacity
                  style={styles.actionBtn}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('MediosPago')}
                >
                  <Text style={styles.actionBtnText}>Configurar →</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.settingRow, { marginTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 }]}>
                <Text style={styles.settingLabel}>Conexión Nube (Supabase):</Text>
                <TouchableOpacity
                  style={styles.actionBtn}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('SupabaseConfig')}
                >
                  <Text style={styles.actionBtnText}>Configurar →</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* SECCIÓN 1: CABECERA CATÁLOGO DE PRODUCTOS */}
            <View style={[styles.sectionTitleContainer, { marginTop: 16 }]}>
              <Text style={styles.sectionTitle}>Catálogo de Productos</Text>
            </View>
          </>
        }
        ListFooterComponent={
          <>
            <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ProductoEdit')}
            >
              <Text style={styles.addButtonText}>+ Nuevo producto</Text>
            </TouchableOpacity>
            {/* SECCIÓN 3: RESPALDO MANUAL */}
            <View style={[styles.sectionCard, { marginTop: 24 }]}>
              <Text style={styles.sectionTitle}>Copias de Seguridad</Text>
              <Text style={styles.backupLog}>Último movimiento: {ultimoBackup}</Text>

              {/* Opción A: Sincronización en la Nube */}
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.backupSubTitle}>Sincronización en la Nube (Online)</Text>
                <Text style={styles.backupNoticeText}>
                  Respalda y recupera tus ventas y catálogo al instante sincronizando de forma bidireccional con Supabase.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBackupBtn, isBackupLoading && styles.backupBtnDisabled]}
                  disabled={isBackupLoading}
                  activeOpacity={0.8}
                  onPress={handleSyncNube}
                >
                  <Text style={styles.primaryBackupBtnText}>Sincronizar con la Nube</Text>
                </TouchableOpacity>
              </View>

              {/* Separador */}
              <View style={{ borderTopWidth: 1, borderTopColor: COLORS.borde, marginVertical: 12 }} />

              {/* Opción B: Copia Local JSON */}
              <View>
                <Text style={styles.backupSubTitle}>Respaldo Local Offline (JSON)</Text>
                <Text style={styles.backupNoticeText}>
                  Guarda o recupera un archivo de texto encriptado en el almacenamiento del dispositivo.
                </Text>
                <View style={styles.rowButtons}>
                  <TouchableOpacity
                    style={[styles.secondaryBackupBtn, { marginRight: 8 }, isBackupLoading && styles.backupBtnDisabled]}
                    disabled={isBackupLoading}
                    activeOpacity={0.8}
                    onPress={handleExportarJSON}
                  >
                    <Text style={styles.secondaryBackupBtnText}>Exportar JSON</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.secondaryBackupBtn, isBackupLoading && styles.backupBtnDisabled]}
                    disabled={isBackupLoading}
                    activeOpacity={0.8}
                    onPress={handleImportarJSON}
                  >
                    <Text style={styles.secondaryBackupBtnText}>Importar JSON</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Indicador de carga de respaldo global */}
              {isBackupLoading && (
                <View style={styles.overlayLoading}>
                  <ActivityIndicator size="small" color="#059669" />
                  <Text style={styles.overlayText}>Procesando copia de seguridad...</Text>
                </View>
              )}
            </View>
          </>
        }
      />
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
  sectionTitleContainer: {
    paddingHorizontal: 4,
    marginBottom: 8,
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
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borde,
  },
  orderButtons: {
    flexDirection: 'row',
    marginRight: 12,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: COLORS.borde,
  },
  arrowBtnDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#f3f4f6',
  },
  arrowText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
  },
  arrowTextDisabled: {
    color: '#d1d5db',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
  },
  productSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  productPrice: {
    fontSize: 13,
    color: COLORS.textoSecundario,
  },
  bullet: {
    marginHorizontal: 6,
    color: '#d1d5db',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusActive: {
    color: COLORS.pagadoVerde,
  },
  statusInactive: {
    color: COLORS.textoSecundario,
  },
  editBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: COLORS.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 14,
  },
  addButton: {
    height: 48,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: COLORS.borde,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  addButtonText: {
    color: COLORS.textoPrimario,
    fontWeight: 'bold',
    fontSize: 14,
  },
  backupLog: {
    fontSize: 14,
    color: COLORS.textoSecundario,
    marginBottom: 12,
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
  inputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.textoSecundario,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    height: 40,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: COLORS.borde,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: COLORS.textoPrimario,
    fontSize: 14,
    marginBottom: 10,
  },
});
