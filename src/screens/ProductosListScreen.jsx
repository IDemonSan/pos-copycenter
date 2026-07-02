import CustomText from '../components/CustomText';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useDb } from '../context/DbContext';
import { useSync } from '../context/SyncContext';
import {
  getTodosLosProductos,
  intercambiarOrden,
  eliminarProducto,
} from '../database/queries/productos';
import { recalcularPendientes } from '../services/syncWorker';
import COLORS from '../constants/colors';

export default function ProductosListScreen() {
  const { db } = useDb();
  const { actualizarConteo } = useSync();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState([]);

  const loadData = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const prodList = await getTodosLosProductos(db);
      setProductos(prodList);
    } catch (err) {
      console.error('[ProductosList] Error al cargar productos:', err);
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

  const handleDelete = (item) => {
    Alert.alert(
      'Eliminar producto',
      `¿Estás seguro de eliminar "${item.nombre}" permanentemente?\n\nEsta acción no se puede deshacer. Las ventas anteriores conservan el nombre del producto.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarProducto(db, item.id);
              await recalcularPendientes(db);
              await actualizarConteo();
              loadData();
            } catch (err) {
              console.error('[ProductosList] Error al eliminar producto:', err);
              Alert.alert('Error', 'No se pudo eliminar el producto.');
            }
          },
        },
      ],
    );
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
            <CustomText style={[styles.arrowText, isFirst && styles.arrowTextDisabled]}>
              ↑
            </CustomText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrowBtn, isLast && styles.arrowBtnDisabled]}
            disabled={isLast}
            activeOpacity={0.7}
            onPress={() => handleMoveDown(index)}
          >
            <CustomText style={[styles.arrowText, isLast && styles.arrowTextDisabled]}>
              ↓
            </CustomText>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.productInfo}>
          <CustomText style={styles.productName}>{item.nombre}</CustomText>
          <View style={styles.productSubRow}>
            <CustomText style={styles.productPrice}>{displayPrice}</CustomText>
            <CustomText style={styles.bullet}>•</CustomText>
            {item.activo === 1 ? (
              <CustomText style={[styles.statusText, styles.statusActive]}>Activo ●</CustomText>
            ) : (
              <CustomText style={[styles.statusText, styles.statusInactive]}>Inactivo ○</CustomText>
            )}
          </View>
        </View>

        {/* Acciones: Editar + Eliminar */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ProductoEdit', { producto: item })}
          >
            <CustomText style={styles.actionIcon}>✏️</CustomText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            activeOpacity={0.7}
            onPress={() => handleDelete(item)}
          >
            <CustomText style={styles.deleteIcon}>🗑️</CustomText>
          </TouchableOpacity>
        </View>
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
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <FlatList
        data={productos}
        keyExtractor={(item) => item.id}
        renderItem={renderProductItem}
        contentContainerStyle={styles.scrollContainer}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ProductoEdit')}
          >
            <CustomText style={styles.addButtonText}>+ Nuevo producto</CustomText>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <CustomText style={styles.emptyText}>No hay productos registrados</CustomText>
            <CustomText style={styles.emptySubtext}>
              Presiona "+ Nuevo producto" para agregar el primer producto al catálogo.
            </CustomText>
          </View>
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: COLORS.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 14,
  },
  deleteBtn: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  deleteIcon: {
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
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textoSecundario,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textoSecundario,
    textAlign: 'center',
    lineHeight: 20,
  },
});
