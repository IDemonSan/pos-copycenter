import React, { createContext, useContext, useState, useEffect } from 'react';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { createSchema } from '../database/schema';
import { runMigrations } from '../database/migrations';
import { seedProductos } from '../database/seed';
import { inicializarSupabase } from '../services/supabaseClient';

const DbContext = createContext({
  db: null,
  isReady: false,
  error: null,
});

/**
 * Hook personalizado para acceder al contexto de la base de datos.
 * @returns {{ db: import('expo-sqlite').SQLiteDatabase, isReady: boolean, error: string | null }}
 */
export function useDb() {
  return useContext(DbContext);
}

/**
 * Componente interno que consume useSQLiteContext() para ejecutar el flujo de inicio.
 */
function DbProviderInner({ children }) {
  const db = useSQLiteContext();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function initializeDatabase() {
      try {
        // 0. Inicializar Supabase dinámicamente desde SecureStore
        await inicializarSupabase();

        // 1. Crear esquema si no existe
        await createSchema(db);
        
        // 2. Ejecutar migraciones pendientes
        await runMigrations(db);
        
        // 3. Sembrar catálogo inicial de productos si está vacío
        await seedProductos(db);
        
        setIsReady(true);
      } catch (err) {
        console.error('[DB Context] Error al inicializar la base de datos:', err);
        setError(err.message || String(err));
      }
    }

    initializeDatabase();
  }, [db]);

  return (
    <DbContext.Provider value={{ db, isReady, error }}>
      {children}
    </DbContext.Provider>
  );
}

/**
 * Proveedor principal de DbContext que envuelve a la app en SQLiteProvider.
 */
export function DbProvider({ children }) {
  return (
    <SQLiteProvider databaseName="pos_copycenter.db">
      <DbProviderInner>{children}</DbProviderInner>
    </SQLiteProvider>
  );
}

export default DbContext;
