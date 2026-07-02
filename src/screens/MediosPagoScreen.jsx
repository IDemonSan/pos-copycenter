import CustomText from '../components/CustomText';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useDb } from '../context/DbContext';
import COLORS from '../constants/colors';

export default function MediosPagoScreen() {
  const { db } = useDb();

  const [loading, setLoading] = useState(true);
  const [medios, setMedios] = useState([]);
  const [bancoNombre, setBancoNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const loadMedios = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const list = await db.getAllAsync('SELECT * FROM medios_pago ORDER BY id DESC;');
      setMedios(list);
    } catch (error) {
      console.error('[MediosPago] Error al cargar medios de pago:', error);
      Alert.alert('Error', 'No se pudieron cargar los medios de pago.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedios();
  }, [db]);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se requiere acceso a la galería para subir el código QR.');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[MediosPago] Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
  };

  const handleAgregarMedio = async () => {
    if (!bancoNombre.trim()) {
      Alert.alert(
        'Campo requerido',
        'Por favor ingresa el nombre del banco o aplicación (ej: Yape, Plin, BCP).',
      );
      return;
    }
    if (!selectedImage) {
      Alert.alert('Imagen requerida', 'Por favor selecciona la imagen del código QR.');
      return;
    }

    setGuardando(true);
    try {
      // 1. Copiar imagen al directorio privado de la app
      const nombreArchivo = `qr_${Date.now()}.jpg`;
      const destinoFinal = `${FileSystem.documentDirectory}${nombreArchivo}`;

      await FileSystem.copyAsync({
        from: selectedImage,
        to: destinoFinal,
      });

      // 2. Insertar en la BD
      await db.runAsync(
        'INSERT INTO medios_pago (banco_nombre, qr_image_path, descripcion) VALUES (?, ?, ?);',
        [bancoNombre.trim(), destinoFinal, descripcion.trim()],
      );

      Alert.alert('Éxito', 'Medio de pago agregado correctamente.');

      // Limpiar campos
      setBancoNombre('');
      setDescripcion('');
      setSelectedImage(null);

      // Recargar lista
      await loadMedios();
    } catch (error) {
      console.error('[MediosPago] Error al agregar medio de pago:', error);
      Alert.alert('Error', 'No se pudo agregar el medio de pago.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarMedio = (item) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Deseas eliminar el medio de pago ${item.banco_nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Borrar archivo físico del almacenamiento
              if (item.qr_image_path) {
                await FileSystem.deleteAsync(item.qr_image_path, { idempotent: true });
              }

              // 2. Eliminar registro de la BD
              await db.runAsync('DELETE FROM medios_pago WHERE id = ?;', [item.id]);

              Alert.alert('Eliminado', 'El medio de pago ha sido eliminado.');
              loadMedios();
            } catch (error) {
              console.error('[MediosPago] Error al eliminar:', error);
              Alert.alert('Error', 'No se pudo eliminar el medio de pago.');
            }
          },
        },
      ],
    );
  };

  const renderMedioItem = ({ item }) => {
    return (
      <View style={styles.card}>
        <Image source={{ uri: item.qr_image_path }} style={styles.qrThumbnail} />
        <View style={styles.cardInfo}>
          <CustomText style={styles.cardBanco}>{item.banco_nombre}</CustomText>
          {item.descripcion ? (
            <CustomText style={styles.cardDesc} numberOfLines={2}>
              {item.descripcion}
            </CustomText>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          activeOpacity={0.7}
          onPress={() => handleEliminarMedio(item)}
        >
          <CustomText style={styles.deleteButtonText}>✕</CustomText>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        {/* Formulario */}
        <View style={styles.formCard}>
          <CustomText style={styles.formTitle}>Nuevo Medio de Pago</CustomText>

          <TextInput
            style={styles.input}
            placeholder="Nombre del banco o app (ej: Yape, Plin)"
            value={bancoNombre}
            onChangeText={setBancoNombre}
            placeholderTextColor="#9ca3af"
          />

          <TextInput
            style={[styles.input, styles.descInput]}
            placeholder="Descripción (ej: Titular, nro de cuenta o celular)"
            value={descripcion}
            onChangeText={setDescripcion}
            placeholderTextColor="#9ca3af"
            multiline={true}
            numberOfLines={2}
          />

          <View style={styles.imagePickerRow}>
            <TouchableOpacity
              style={[styles.pickerBtn, selectedImage && styles.pickerBtnWithImg]}
              activeOpacity={0.7}
              onPress={handlePickImage}
            >
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={styles.selectedQrPreview} />
              ) : (
                <CustomText style={styles.pickerBtnText}>📷 Seleccionar Código QR</CustomText>
              )}
            </TouchableOpacity>

            {selectedImage ? (
              <TouchableOpacity
                style={styles.clearImageBtn}
                activeOpacity={0.7}
                onPress={() => setSelectedImage(null)}
              >
                <CustomText style={styles.clearImageText}>Quitar Imagen</CustomText>
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, guardando && styles.saveBtnDisabled]}
            activeOpacity={0.8}
            onPress={handleAgregarMedio}
            disabled={guardando}
          >
            {guardando ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <CustomText style={styles.saveBtnText}>Guardar Medio de Pago</CustomText>
            )}
          </TouchableOpacity>
        </View>

        {/* Listado */}
        <View style={styles.listSection}>
          <CustomText style={styles.listTitle}>Medios de Pago Activos</CustomText>
          {loading ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 24 }} />
          ) : medios.length === 0 ? (
            <CustomText style={styles.emptyListText}>No hay medios de pago registrados.</CustomText>
          ) : (
            <FlatList
              data={medios}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderMedioItem}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 12,
  },
  descInput: {
    height: 60,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  imagePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerBtn: {
    flex: 1,
    height: 60,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pickerBtnWithImg: {
    backgroundColor: '#fff',
    borderColor: '#3b82f6',
  },
  pickerBtnText: {
    color: '#4b5563',
    fontWeight: '600',
    fontSize: 13,
  },
  selectedQrPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  clearImageBtn: {
    marginLeft: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
  },
  clearImageText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: 'bold',
  },
  saveBtn: {
    height: 48,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#93c5fd',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  listSection: {
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  emptyListText: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 20,
    fontStyle: 'italic',
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  qrThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardBanco: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  cardDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
