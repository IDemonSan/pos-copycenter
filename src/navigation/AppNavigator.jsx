import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as NavigationBar from 'expo-navigation-bar';
import { useConfig } from '../context/ConfigContext';

import HomeScreen from '../screens/HomeScreen';
import MetricasScreen from '../screens/MetricasScreen';
import MetricasDetalleDiasScreen from '../screens/MetricasDetalleDiasScreen';
import MetricasDetalleDiaScreen from '../screens/MetricasDetalleDiaScreen';
import MetricasDetalleMesesScreen from '../screens/MetricasDetalleMesesScreen';
import POSScreen from '../screens/POSScreen';
import SalonesScreen from '../screens/SalonesScreen';
import AulaDetailScreen from '../screens/AulaDetailScreen';
import ConfigScreen from '../screens/ConfigScreen';
import ProductosListScreen from '../screens/ProductosListScreen';
import ProductoEditScreen from '../screens/ProductoEditScreen';
import MediosPagoScreen from '../screens/MediosPagoScreen';
import SupabaseConfigScreen from '../screens/SupabaseConfigScreen';
import SyncStatusIcon from '../components/SyncStatusIcon';
import ReconnectBanner from '../components/ReconnectBanner';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();



// Opciones de header comunes con el SyncStatusIcon
const defaultStackOptions = {
  headerStyle: {
    backgroundColor: '#1f2937',
  },
  headerTintColor: '#fff',
  headerTitleStyle: {
    fontWeight: 'bold',
  },
  headerRight: () => <SyncStatusIcon />,
};

function InicioStack() {
  return (
    <Stack.Navigator screenOptions={defaultStackOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Inicio' }}
      />
      <Stack.Screen
        name="AulaDetail"
        component={AulaDetailScreen}
        options={{ title: 'Detalle de Aula' }}
      />
      <Stack.Screen
        name="Metricas"
        component={MetricasScreen}
        options={{ title: 'Métricas' }}
      />
      <Stack.Screen
        name="MetricasDetalleDias"
        component={MetricasDetalleDiasScreen}
        options={{ title: 'Ventas por Día' }}
      />
      <Stack.Screen
        name="MetricasDetalleDia"
        component={MetricasDetalleDiaScreen}
        options={{ title: 'Detalle del Día' }}
      />
      <Stack.Screen
        name="MetricasDetalleMeses"
        component={MetricasDetalleMesesScreen}
        options={{ title: 'Ventas por Mes' }}
      />
    </Stack.Navigator>
  );
}

function SalonesStack() {
  return (
    <Stack.Navigator screenOptions={defaultStackOptions}>
      <Stack.Screen
        name="SalonesHome"
        component={SalonesScreen}
        options={{ title: 'Salones' }}
      />
      <Stack.Screen
        name="AulaDetail"
        component={AulaDetailScreen}
        options={{ title: 'Detalle de Aula' }}
      />
    </Stack.Navigator>
  );
}

function ConfigStack() {
  return (
    <Stack.Navigator screenOptions={defaultStackOptions}>
      <Stack.Screen
        name="ConfigHome"
        component={ConfigScreen}
        options={{ title: 'Configuración' }}
      />
      <Stack.Screen
        name="ProductosList"
        component={ProductosListScreen}
        options={{ title: 'Catálogo de Productos' }}
      />
      <Stack.Screen
        name="ProductoEdit"
        component={ProductoEditScreen}
        options={{ title: 'Editar Producto' }}
      />
      <Stack.Screen
        name="MediosPago"
        component={MediosPagoScreen}
        options={{ title: 'Medios de Pago' }}
      />
      <Stack.Screen
        name="SupabaseConfig"
        component={SupabaseConfigScreen}
        options={{ title: 'Conexión a la Nube' }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { mostrarEtiquetasMenu, mostrarBannerReconexion } = useConfig();

  return (
    <View style={{ flex: 1 }}>
      {mostrarBannerReconexion && <ReconnectBanner />}
      <Tab.Navigator
        safeAreaInsets={{ bottom: 0 }}
        screenListeners={{
          state: () => {
            if (Platform.OS === 'android' && NavigationBar) {
              try {
                // Forzamos el modo pegajoso y ocultamos EN BLOQUE
                NavigationBar.setBehaviorAsync('sticky-immersive');
                NavigationBar.setVisibilityAsync('hidden');
              } catch (e) {
                console.warn('[TabListener] Error:', e);
              }
            }
          },
        }}
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'InicioTab') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'POS') {
              iconName = focused ? 'add-circle' : 'add-circle-outline';
              // Botón central de POS más grande
              return <Ionicons name={iconName} size={32} color={color} />;
            } else if (route.name === 'Salones') {
              iconName = focused ? 'people' : 'people-outline';
            } else if (route.name === 'ConfigTab') {
              iconName = focused ? 'settings' : 'settings-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#3b82f6',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarShowLabel: mostrarEtiquetasMenu,
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopColor: '#e5e7eb',
            height: mostrarEtiquetasMenu ? 60 : 50,
            paddingBottom: mostrarEtiquetasMenu ? 8 : 0,
          },
        })}
      >
        <Tab.Screen
          name="InicioTab"
          component={InicioStack}
          options={{ title: 'Inicio', headerShown: false }}
        />
        <Tab.Screen
          name="POS"
          component={POSScreen}
          options={{
            title: 'Nueva Venta',
            headerStyle: { backgroundColor: '#1f2937' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
            headerRight: () => <SyncStatusIcon />,
          }}
        />
        <Tab.Screen
          name="Salones"
          component={SalonesStack}
          options={{ title: 'Salones', headerShown: false }}
        />
        <Tab.Screen
          name="ConfigTab"
          component={ConfigStack}
          options={{
            title: 'Config',
            headerShown: false,
          }}
        />
      </Tab.Navigator>
    </View>
  );
}
