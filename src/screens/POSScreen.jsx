import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
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

const AULAS = [
  '1° A', '1° B', '2° A', '2° B', '3° A', '3° B',
  '4° A', '4° B', '5° A', '5° B', '6° A', '6° B',
];

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
    bufferCantidad,
    aulaSeleccionada,
    turnoActivo,
    fechaVenta,
    shakeSignals,
    agregarDigito,
    borrarDigito,
    agregarAlCarrito,
    agregarProductoVariable,
    quitarDelCarrito,
    confirmarVenta,
    setAula,
    setTurno,
    setFechaVenta,
    recargarTurno,
  } = useVenta();

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
    cantidad: 0,
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

  const handleProductPress = async (producto) => {
    const result = await agregarAlCarrito(producto);
    if (result && result.needsPrice) {
      setVariableProductModal({
        visible: true,
        producto: result.producto,
        cantidad: result.cantidad,
        precioSoles: '',
      });
    }
  };

  const handleConfirmVariablePrice = () => {
    const precioFloat = parseFloat(variableProductModal.precioSoles);
    if (isNaN(precioFloat) || precioFloat <= 0) {
      Alert.alert('Precio inválido', 'Por favor ingresa un precio mayor a 0.');
      return;
    }

    const priceCents = Math.round(precioFloat * 100);
    agregarProductoVariable(
      variableProductModal.producto,
      variableProductModal.cantidad,
      priceCents
    );

    setVariableProductModal({
      visible: false,
      producto: null,
      cantidad: 0,
      precioSoles: '',
    });
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const formatted = selectedDate.toISOString().slice(0, 10);
      const applied = setFechaVenta(formatted);
      if (!applied) {
        Alert.alert('Fecha inválida', 'No se permiten registrar ventas con fechas futuras.');
      }
    }
  };

  const handleConfirmarVentaPress = () => {
    if (!aulaSeleccionada) {
      Alert.alert('Falta el aula', 'Selecciona un aula antes de confirmar la venta.');
      return;
    }

    const totalCents = carrito.reduce((sum, item) => sum + item.subtotal_cents, 0);
    const totalSoles = (totalCents / 100).toFixed(2);

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

  const totalCents = carrito.reduce((sum, item) => sum + item.subtotal_cents, 0);
  const totalSoles = (totalCents / 100).toFixed(2);
  const isToday = fechaVenta === new Date().toISOString().slice(0, 10);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Nueva Venta</Text>
          <TouchableOpacity
            style={styles.turnoBadge}
            activeOpacity={0.7}
            onPress={() => setTurno(turnoActivo === 'Mañana' ? 'Tarde' : 'Mañana')}
          >
            <Text style={styles.turnoText}>Turno: {turnoActivo}</Text>
          </TouchableOpacity>
        </View>

        {/* SELECTORS */}
        <View style={styles.selectors}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={aulaSeleccionada}
              onValueChange={(val) => setAula(val)}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar aula..." value="" />
              {AULAS.map((aula) => (
                <Picker.Item label={aula} value={aula} key={aula} />
              ))}
            </Picker>
          </View>

          <TouchableOpacity
            style={styles.dateSelector}
            activeOpacity={0.7}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={[styles.dateText, !isToday && styles.dateTextBatch]}>
              Fecha: {formatReadableDate(fechaVenta)} ✎
            </Text>
          </TouchableOpacity>
        </View>

        {/* CARRITO */}
        <View style={styles.cartSection}>
          {carrito.length === 0 ? (
            <View style={styles.emptyCart}>
              <Text style={styles.emptyCartText}>Agrega productos</Text>
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

          {/* TOTAL & BUFFER DISPLAY */}
          <View style={styles.cartFooter}>
            <View style={styles.bufferRow}>
              <Text style={styles.bufferLabel}>Buffer cantidad:</Text>
              <Text style={styles.bufferValue}>{bufferCantidad || '0'}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL:</Text>
              <Text style={styles.totalValue}>S/ {totalSoles}</Text>
            </View>
          </View>
        </View>

        {/* PRODUCTOS */}
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
                  shakeSignal={shakeSignals[item.id] || 0}
                />
              </View>
            )}
            scrollEnabled={true}
          />
        </View>

        {/* NUMPAD */}
        <View style={styles.numpadSection}>
          <NumPad
            onDigit={agregarDigito}
            onBackspace={borrarDigito}
            onConfirmar={handleConfirmarVentaPress}
            confirmDisabled={carrito.length === 0}
          />
        </View>

        {/* DATE PICKER */}
        {showDatePicker && (
          <DateTimePicker
            value={new Date(fechaVenta + 'T12:00:00')}
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
              <Text style={styles.modalTitle}>Precio Variable</Text>
              <Text style={styles.modalSubtitle}>
                {variableProductModal.producto?.nombre} - Cantidad: {variableProductModal.cantidad}
              </Text>
              
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
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={handleConfirmVariablePrice}
                >
                  <Text style={styles.modalConfirmText}>Agregar</Text>
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
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#1f2937',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  turnoBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  turnoText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  selectors: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
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
    flex: 1,
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
  cartFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  bufferRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bufferLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  bufferValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
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
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 4,
  },
  productCol: {
    flex: 1 / 3,
    padding: 2,
  },
  numpadSection: {
    height: 220,
    backgroundColor: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    width: '80%',
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
