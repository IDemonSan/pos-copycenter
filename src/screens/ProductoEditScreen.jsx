import CustomText from '../components/CustomText';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDb } from '../context/DbContext';
import { insertarProducto, actualizarProducto } from '../database/queries/productos';
import { recalcularPendientes } from '../services/syncWorker';
import COLORS from '../constants/colors';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default function ProductoEditScreen() {
  const { db } = useDb();
  const navigation = useNavigation();
  const route = useRoute();

  const producto = route.params?.producto;
  const isEditing = !!producto;

  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [isVariable, setIsVariable] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const [activo, setActivo] = useState(true);

  // Guardar el precio inicial para comparar y mostrar la advertencia
  const [precioInicial, setPrecioInicial] = useState('');

  useEffect(() => {
    if (isEditing && producto) {
      setNombre(producto.nombre);
      setIsVariable(producto.is_variable === 1);
      setIsCustom(producto.is_custom === 1);
      setActivo(producto.activo === 1);
      
      const soles = (producto.precio_cents / 100).toString();
      setPrecio(soles);
      setPrecioInicial(soles);
    }
  }, [isEditing, producto]);

  const handleSave = async () => {
    // 1. Validar nombre
    const trimmedNombre = nombre.trim();
    if (!trimmedNombre) {
      Alert.alert('Falta información', 'El nombre del producto es obligatorio.');
      return;
    }
    if (trimmedNombre.length > 40) {
      Alert.alert('Nombre largo', 'El nombre del producto no puede superar los 40 caracteres.');
      return;
    }

    // 2. Validar precio si no es variable ni personalizado
    let priceCents = 0;
    if (!isVariable && !isCustom) {
      const precioFloat = parseFloat(precio);
      if (isNaN(precioFloat) || precioFloat <= 0) {
        Alert.alert('Precio inválido', 'El precio debe ser un número mayor a 0.');
        return;
      }
      priceCents = Math.round(precioFloat * 100);
      if (isNaN(priceCents) || priceCents <= 0) {
        Alert.alert('Precio inválido', 'El precio ingresado no es válido.');
        return;
      }
    }

    try {
      if (isEditing) {
        const productoActualizado = {
          ...producto,
          nombre: trimmedNombre,
          precio_cents: priceCents,
          is_variable: isVariable ? 1 : 0,
          is_custom: isCustom ? 1 : 0,
          activo: activo ? 1 : 0,
        };
        await actualizarProducto(db, productoActualizado);
      } else {
        // Encontrar maxOrdenActual
        const result = await db.getFirstAsync("SELECT MAX(orden_prioridad) as maxOrden FROM productos;");
        const maxOrdenActual = result?.maxOrden ?? 0;

        const nuevoProducto = {
          id: generateUUID(),
          nombre: trimmedNombre,
          precio_cents: priceCents,
          is_variable: isVariable ? 1 : 0,
          is_custom: isCustom ? 1 : 0,
          orden_prioridad: maxOrdenActual + 1,
          activo: activo ? 1 : 0,
        };
        await insertarProducto(db, nuevoProducto);
      }
      
      // Recalcular contador de pendientes en tiempo real
      await recalcularPendientes(db);

      navigation.goBack();
    } catch (err) {
      console.error('[ProductEdit] Error al guardar producto:', err);
      Alert.alert('Error', 'No se pudo guardar el producto. Intenta de nuevo.');
    }
  };

  const handleDesactivar = () => {
    Alert.alert(
      'Desactivar producto',
      `"${nombre}" dejará de aparecer en el POS. Puedes reactivarlo después.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await actualizarProducto(db, {
                ...producto,
                activo: 0,
              });
              navigation.goBack();
            } catch (err) {
              console.error('[ProductEdit] Error al desactivar producto:', err);
              Alert.alert('Error', 'No se pudo desactivar el producto.');
            }
          },
        },
      ]
    );
  };

  const handleToggleVariable = (val) => {
    setIsVariable(val);
    if (val) setIsCustom(false);
  };

  const handleToggleCustom = (val) => {
    setIsCustom(val);
    if (val) setIsVariable(false);
  };

  const showPriceWarning = isEditing && !isVariable && !isCustom && precio !== precioInicial && precio !== '';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <CustomText style={styles.label}>Nombre del producto *</CustomText>
        <TextInput
          style={styles.input}
          placeholder="Ej: Copia B/N Anillado"
          maxLength={40}
          value={nombre}
          onChangeText={setNombre}
        />

        {/* Switch precio variable */}
        <View style={styles.switchRow}>
          <CustomText style={styles.settingLabel}>Precio variable (solo precio editable)</CustomText>
          <Switch
            value={isVariable}
            onValueChange={handleToggleVariable}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={isVariable ? '#3b82f6' : '#f3f4f6'}
          />
        </View>

        {/* Switch personalizado / caso especial */}
        <View style={styles.switchRow}>
          <CustomText style={styles.settingLabel}>Caso Especial (Nombre y precio editables)</CustomText>
          <Switch
            value={isCustom}
            onValueChange={handleToggleCustom}
            trackColor={{ false: '#d1d5db', true: '#fbcfe8' }}
            thumbColor={isCustom ? '#ec4899' : '#f3f4f6'}
          />
        </View>

        {/* Campo precio (oculto si precio variable o caso especial) */}
        {!isVariable && !isCustom && (
          <View style={styles.priceContainer}>
            <CustomText style={styles.label}>Precio (en soles) *</CustomText>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="numeric"
              value={precio}
              onChangeText={setPrecio}
            />
            {showPriceWarning && (
              <CustomText style={styles.warningText}>
                ℹ️ Las ventas registradas anteriormente mantienen el precio original.
              </CustomText>
            )}
          </View>
        )}

        {/* Switch activo */}
        <View style={styles.switchRow}>
          <CustomText style={styles.settingLabel}>Activo en POS</CustomText>
          <Switch
            value={activo}
            onValueChange={setActivo}
            trackColor={{ false: '#d1d5db', true: '#a7f3d0' }}
            thumbColor={activo ? COLORS.pagadoVerde : '#f3f4f6'}
          />
        </View>

        {/* Botones de Acción */}
        <TouchableOpacity
          style={styles.saveButton}
          activeOpacity={0.8}
          onPress={handleSave}
        >
          <CustomText style={styles.saveButtonText}>Guardar Producto</CustomText>
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity
            style={styles.deleteButton}
            activeOpacity={0.8}
            onPress={handleDesactivar}
          >
            <CustomText style={styles.deleteButtonText}>Desactivar Producto</CustomText>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.fondoPantalla,
  },
  container: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textoSecundario,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 48,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.borde,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: COLORS.textoPrimario,
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borde,
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
    color: COLORS.textoPrimario,
    fontWeight: '500',
  },
  priceContainer: {
    width: '100%',
  },
  warningText: {
    fontSize: 13,
    color: COLORS.batchNaranja,
    marginBottom: 16,
    fontWeight: '500',
    lineHeight: 18,
  },
  saveButton: {
    height: 50,
    backgroundColor: COLORS.pagadoVerde,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteButton: {
    height: 50,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.deudaRojo,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: COLORS.deudaRojo,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
