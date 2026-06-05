import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useDb } from '../context/DbContext';
import { useVenta } from '../context/VentaContext';
import { useIsFocused } from '@react-navigation/native';
import { getProductosActivos } from '../database/queries/productos';
import NumPad from '../components/NumPad';
import ProductButton from '../components/ProductButton';
import CartItem from '../components/CartItem';
import SyncStatusIcon from '../components/SyncStatusIcon';
import CustomText from '../components/CustomText';
import { scaleFont } from '../utils/responsive';

const obtenerFechaLocal = () => {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

const AULAS_POR_TURNO = {
  'Mañana': [
    '1° A', '1° B',
    '2° A', '2° B',
    '3° A', '3° B',
    '4° A', '4° B',
    '5° A', '5° B',
    '6° A', '6° B',
  ],
  'Tarde': [
    '1° C',
    '2° C',
    '3° C',
    '4° C',
    '5° C',
    '6° C',
  ],
};

function formatReadableDate(dateString) {
  try {
    const date = new Date(dateString + 'T12:00:00');
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  } catch (e) {
    return dateString;
  }
}

export default function POSScreen({ route, navigation }) {
  const { db } = useDb();
  const {
    carrito,
    totalCarritoCents,
    isGuardando,
    displayBuffer,
    isModoMultiplicacion,
    shakeSignal,
    handleNumberPress,
    handleXPress,
    handleBackspace,
    agregarAlCarrito,
    agregarAlCarritoConPrecio,
    agregarAlCarritoCustom,
    quitarDelCarrito,
    limpiarCarrito,
    confirmarVenta,
    aulaSeleccionada,
    turnoActivo,
    fechaVenta,
    setAula,
    setTurno,
    setFechaVenta,
    recargarTurno,
  } = useVenta();

  const aulasDisponibles = AULAS_POR_TURNO[turnoActivo] ?? AULAS_POR_TURNO['Mañana'];

  const handleCambiarTurno = (nuevoTurno) => {
    setTurno(nuevoTurno);

    // Si el aula actual no existe en el nuevo turno, limpiarla
    const aulasNuevas = AULAS_POR_TURNO[nuevoTurno] ?? [];
    if (!aulasNuevas.includes(aulaSeleccionada)) {
      setAula('');
    }
  };

  const isFocused = useIsFocused();
  const [productos, setProductos] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Leer y aplicar parámetros de navegación (anulaciones de T3)
  useEffect(() => {
    const aulaPre = route?.params?.aulaPreseleccionada;
    const fechaPre = route?.params?.fechaPreseleccionada;

    if (aulaPre) {
      setAula(aulaPre);
    }
    if (fechaPre) {
      setFechaVenta(fechaPre);
    }

    if (aulaPre || fechaPre) {
      navigation?.setParams({
        aulaPreseleccionada: undefined,
        fechaPreseleccionada: undefined,
      });
    }
  }, [route?.params]);
  
  // Estado para el modal de precio variable
  const [variableProductModal, setVariableProductModal] = useState({
    visible: false,
    producto: null,
    totalUnidades: 0,
    multiplicadorInfo: null,
    precioSoles: '',
  });

  // Estado para el modal de producto personalizado (Caso Especial)
  const [customProductModal, setCustomProductModal] = useState({
    visible: false,
    producto: null,
    totalUnidades: 0,
    multiplicadorInfo: null,
    nombreCustom: '',
    precioSoles: '',
  });

  // Cargar productos activos y turno de la base de datos al recibir foco
  useEffect(() => {
    if (isFocused && db) {
      getProductosActivos(db)
        .then(setProductos)
        .catch((err) => console.error('[POS] Error al cargar productos activos:', err));
      recargarTurno(db);
    }
  }, [isFocused, db]);

  // Configurar header nativo de forma dinámica con el selector de turno
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
          <View style={{
            flexDirection: 'row',
            backgroundColor: '#374151',
            borderRadius: 8,
            padding: 2,
            marginRight: 8,
          }}>
            <TouchableOpacity
              onPress={() => handleCambiarTurno('Mañana')}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: turnoActivo === 'Mañana' ? '#3b82f6' : 'transparent',
              }}
            >
              <CustomText style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>AM</CustomText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleCambiarTurno('Tarde')}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: turnoActivo === 'Tarde' ? '#3b82f6' : 'transparent',
              }}
            >
              <CustomText style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>PM</CustomText>
            </TouchableOpacity>
          </View>
          <SyncStatusIcon />
        </View>
      )
    });
  }, [navigation, turnoActivo, aulaSeleccionada]);

  const handleProductPress = async (producto) => {
    const result = await agregarAlCarrito(producto);
    if (result) {
      if (result.needsCustom) {
        setCustomProductModal({
          visible: true,
          producto: result.producto,
          totalUnidades: result.totalUnidades,
          multiplicadorInfo: result.multiplicadorInfo,
          nombreCustom: result.producto.nombre === 'Otro' || result.producto.nombre === 'Otros' || result.producto.nombre === 'Caso Especial' ? '' : result.producto.nombre,
          precioSoles: '',
        });
      } else if (result.needsPrice) {
        setVariableProductModal({
          visible: true,
          producto: result.producto,
          totalUnidades: result.totalUnidades,
          multiplicadorInfo: result.multiplicadorInfo,
          precioSoles: '',
        });
      }
    }
  };

  const handleConfirmVariablePrice = () => {
    const precioFloat = parseFloat(variableProductModal.precioSoles);
    if (isNaN(precioFloat) || precioFloat <= 0) {
      Alert.alert('Precio inválido', 'Por favor ingresa un precio mayor a 0.');
      return;
    }

    const priceCents = Math.round(precioFloat * 100);
    agregarAlCarritoConPrecio({
      producto: variableProductModal.producto,
      totalUnidades: variableProductModal.totalUnidades,
      multiplicadorInfo: variableProductModal.multiplicadorInfo,
      precioUnitarioCents: priceCents,
    });

    setVariableProductModal({
      visible: false,
      producto: null,
      totalUnidades: 0,
      multiplicadorInfo: null,
      precioSoles: '',
    });
  };

  const handleConfirmCustomProduct = () => {
    const trimmedNombre = customProductModal.nombreCustom.trim();
    if (!trimmedNombre) {
      Alert.alert('Falta descripción', 'Por favor ingresa una descripción para el producto.');
      return;
    }

    const precioFloat = parseFloat(customProductModal.precioSoles);
    if (isNaN(precioFloat) || precioFloat <= 0) {
      Alert.alert('Precio inválido', 'Por favor ingresa un precio mayor a 0.');
      return;
    }

    const priceCents = Math.round(precioFloat * 100);
    agregarAlCarritoCustom({
      producto: customProductModal.producto,
      nombreCustom: trimmedNombre,
      totalUnidades: customProductModal.totalUnidades,
      multiplicadorInfo: customProductModal.multiplicadorInfo,
      precioUnitarioCents: priceCents,
    });

    setCustomProductModal({
      visible: false,
      producto: null,
      totalUnidades: 0,
      multiplicadorInfo: null,
      nombreCustom: '',
      precioSoles: '',
    });
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    
    if (selectedDate) {
      // 1. Obtener la fecha de hoy a las 00:00:00 para comparar solo el día
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      // 2. Crear una copia de la fecha seleccionada a las 00:00:00
      const fechaSeleccionada = new Date(selectedDate);
      fechaSeleccionada.setHours(0, 0, 0, 0);
      // 3. Validar de forma directa si es una fecha futura
      if (fechaSeleccionada > hoy) {
        Alert.alert('Fecha inválida', 'No se permiten registrar ventas con fechas futuras.');
        return;
      }
      // 4. Si pasó la validación, la formateamos utilizando los componentes locales
      const año = selectedDate.getFullYear();
      const mes = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dia = String(selectedDate.getDate()).padStart(2, '0');
      const formatted = `${año}-${mes}-${dia}`;
      setFechaVenta(formatted); 
    }
  };

  const handleConfirmarVentaPress = () => {
    if (!aulaSeleccionada) {
      Alert.alert('Falta el aula', 'Selecciona un aula antes de confirmar la venta.');
      return;
    }

    const totalSoles = (totalCarritoCents / 100).toFixed(2);

    Alert.alert(
      'Confirmar venta',
      `¿Registrar S/ ${totalSoles} para ${aulaSeleccionada}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await confirmarVenta();
            } catch (err) {
              Alert.alert('Error', 'No se pudo guardar la venta. Intenta de nuevo.');
            }
          },
        },
      ]
    );
  };

  const totalSoles = (totalCarritoCents / 100).toFixed(2);
  const isToday = fechaVenta === obtenerFechaLocal();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* SECCIÓN SUPERIOR (Filtros y Metadatos) - Altura intrínseca */}
        <View style={styles.selectors}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={aulaSeleccionada}
              onValueChange={(val) => setAula(val)}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar aula..." value="" />
              {aulasDisponibles.map((aula) => (
                <Picker.Item label={aula} value={aula} key={aula} />
              ))}
            </Picker>
          </View>

          <TouchableOpacity
            style={styles.dateSelector}
            activeOpacity={0.7}
            onPress={() => setShowDatePicker(true)}
          >
            <CustomText style={[styles.dateText, !isToday && styles.dateTextBatch]}>
              Fecha: {formatReadableDate(fechaVenta)} ✎
            </CustomText>
          </TouchableOpacity>
        </View>

        {/* SECCIÓN CENTRAL (Carrito / Detalle de Productos) - flex: 1 dinámico */}
        <View style={styles.cartSection}>
          {carrito.length === 0 ? (
            <View style={styles.emptyCart}>
              <CustomText style={styles.emptyCartText}>Agrega productos</CustomText>
            </View>
          ) : (
            <FlatList
              data={carrito}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <CartItem item={item} onRemove={quitarDelCarrito} />
              )}
              contentContainerStyle={styles.cartListContent}
            />
          )}
        </View>

        {/* SECCIÓN INFERIOR (Módulo de Control unificado con límites máximos) */}
        <View style={styles.lowerSection}>
          
          {/* TOTAL ROW (Antes era parte de la sección de carrito, ahora anclado al control del pie) */}
          <View style={styles.cartFooter}>
            <View style={styles.totalRow}>
              <CustomText style={styles.totalLabel}>TOTAL:</CustomText>
              <CustomText style={styles.totalValue}>S/ {totalSoles}</CustomText>
            </View>
          </View>

          {/* GRID DE PRODUCTOS - maxHeight estructural */}
          <View style={styles.productsSection}>
            <FlatList
              data={productos}
              keyExtractor={(item) => item.id}
              numColumns={3}
              renderItem={({ item }) => (
                <View style={styles.productCol}>
                  <ProductButton
                    producto={item}
                    onPress={handleProductPress}
                    shakeSignal={shakeSignal}
                  />
                </View>
              )}
              scrollEnabled={true}
            />
          </View>

          {/* INDICADOR DE BUFFER */}
          <View style={styles.bufferIndicador}>
            <CustomText style={styles.bufferTexto}>
              {displayBuffer || '—'}
            </CustomText>
            {isModoMultiplicacion && (
              <CustomText style={styles.bufferHint}>
                toca un producto para agregar al carrito
              </CustomText>
            )}
          </View>

          {/* NUMPAD */}
          <View style={styles.numpadSection}>
            <NumPad
              onNumber={handleNumberPress}
              onX={handleXPress}
              onBackspace={handleBackspace}
              onConfirmar={handleConfirmarVentaPress}
              confirmDisabled={carrito.length === 0}
              isModoMultiplicacion={isModoMultiplicacion}
            />
          </View>

        </View>

        {/* DATE PICKER */}
        {showDatePicker && (
          <DateTimePicker
            value={(() => {
              const [año, mes, dia] = fechaVenta.split('-').map(Number);
              return new Date(año, mes - 1, dia);
            })()}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={handleDateChange}
          />
        )}

        {/* MODAL PRECIO VARIABLE */}
        <Modal
          visible={variableProductModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() =>
            setVariableProductModal((prev) => ({ ...prev, visible: false }))
          }
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <CustomText style={styles.modalTitle}>Precio Variable</CustomText>
              <CustomText style={styles.modalSubtitle}>
                {variableProductModal.producto?.nombre} - {
                  variableProductModal.multiplicadorInfo
                    ? `${variableProductModal.multiplicadorInfo.split('x')[0]} copias × ${variableProductModal.multiplicadorInfo.split('x')[1]} originales = ${variableProductModal.totalUnidades} unidades`
                    : `${variableProductModal.totalUnidades} unidad(es)`
                }
              </CustomText>
              
              <TextInput
                style={styles.priceInput}
                placeholder="0.00"
                keyboardType="numeric"
                autoFocus={true}
                value={variableProductModal.precioSoles}
                onChangeText={(text) =>
                  setVariableProductModal((prev) => ({ ...prev, precioSoles: text }))
                }
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() =>
                    setVariableProductModal((prev) => ({ ...prev, visible: false }))
                  }
                >
                  <CustomText style={styles.modalCancelText}>Cancelar</CustomText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={handleConfirmVariablePrice}
                >
                  <CustomText style={styles.modalConfirmText}>Agregar</CustomText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL CASO ESPECIAL (PERSONALIZADO) */}
        <Modal
          visible={customProductModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() =>
            setCustomProductModal((prev) => ({ ...prev, visible: false }))
          }
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <CustomText style={styles.modalTitle}>Caso Especial</CustomText>
              <CustomText style={styles.modalSubtitle}>
                {customProductModal.multiplicadorInfo
                  ? `${customProductModal.multiplicadorInfo.split('x')[0]} copias × ${customProductModal.multiplicadorInfo.split('x')[1]} originales = ${customProductModal.totalUnidades} unidades`
                  : `${customProductModal.totalUnidades} unidad(es)`
                }
              </CustomText>
              
              <CustomText style={{ marginTop: 10, alignSelf: 'flex-start', fontSize: 11, fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Descripción / Nombre:</CustomText>
              <TextInput
                style={[styles.priceInput, { marginBottom: 12, width: '100%' }]}
                placeholder="Ej: Copias color del director"
                autoFocus={true}
                value={customProductModal.nombreCustom}
                onChangeText={(text) =>
                  setCustomProductModal((prev) => ({ ...prev, nombreCustom: text }))
                }
              />

              <CustomText style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Precio (en soles):</CustomText>
              <TextInput
                style={[styles.priceInput, { width: '100%' }]}
                placeholder="0.00"
                keyboardType="numeric"
                value={customProductModal.precioSoles}
                onChangeText={(text) =>
                  setCustomProductModal((prev) => ({ ...prev, precioSoles: text }))
                }
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() =>
                    setCustomProductModal((prev) => ({ ...prev, visible: false }))
                  }
                >
                  <CustomText style={styles.modalCancelText}>Cancelar</CustomText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={handleConfirmCustomProduct}
                >
                  <CustomText style={styles.modalConfirmText}>Agregar</CustomText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between', // Distribución vertical estricta
  },
  selectors: {
    height: 'auto', // Altura intrínseca
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  pickerWrapper: {
    flex: 1.2,
    justifyContent: 'center',
  },
  picker: {
    height: 40,
    width: '100%',
  },
  dateSelector: {
    flex: 0.8,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  dateTextBatch: {
    color: '#f97316',
  },
  cartSection: {
    flex: 1, // Absorbe todo el espacio dinámico de la pantalla
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  emptyCart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartText: {
    color: '#9ca3af',
    fontSize: 16,
    fontStyle: 'italic',
  },
  cartListContent: {
    paddingVertical: 8,
  },
  lowerSection: {
    width: '100%',
    maxWidth: 600, // Limita la deformación en pantallas anchas
    alignSelf: 'center', // Centrado horizontal
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cartFooter: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
  },
  productsSection: {
    height: 180,
    maxHeight: 180, // Límite de expansión estricto
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 4,
  },
  productCol: {
    flex: 1 / 3,
    padding: 2,
  },
  bufferIndicador: {
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  bufferTexto: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 2,
  },
  bufferHint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  numpadSection: {
    backgroundColor: '#fff',
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    width: '80%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  priceInput: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 18,
    textAlign: 'center',
    color: '#1f2937',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  modalCancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  modalCancelText: {
    color: '#4b5563',
    fontWeight: '600',
  },
  modalConfirmButton: {
    backgroundColor: '#22c55e',
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
