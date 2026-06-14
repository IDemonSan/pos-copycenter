import { marcarComoPagado } from '../ventas';

// ───── Helpers ─────────────────────────────────────────────────────────────

function createMockDb() {
  const pendientes = [];
  const updates = [];

  return {
    pendientes,
    updates,
    withTransactionAsync: jest.fn((fn) => fn()),
    getAllAsync: jest.fn((sql, params) => {
      // Simular la query FIFO dentro de marcarComoPagado
      if (sql.includes('ORDER BY fecha_venta ASC')) {
        return Promise.resolve(pendientes);
      }
      return Promise.resolve([]);
    }),
    runAsync: jest.fn((sql, params) => {
      updates.push({ sql, params });
      return Promise.resolve();
    }),
    // Método para configurar ventas pendientes
    setPendientes(list) {
      pendientes.length = 0;
      list.forEach((v) => pendientes.push(v));
    },
  };
}

function createVenta(id, total_cents, pagado_cents = 0) {
  return { id, total_cents, pagado_cents };
}

// ───── Tests ───────────────────────────────────────────────────────────────

describe('marcarComoPagado', () => {
  let db;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('Pago total (sin montoCents)', () => {
    it('marca todas las ventas como pagadas al 100%', async () => {
      const ventaIds = ['v1', 'v2'];

      await marcarComoPagado(db, { ventaIds });

      expect(db.runAsync).toHaveBeenCalledTimes(2);

      // Cada UPDATE: SET estado_pago=1, pagado_cents=total_cents, ..., updated_at=? WHERE id=?
      expect(db.updates[0].sql).toContain('UPDATE ventas');
      // params: [now (timestamp), id]
      expect(db.updates[0].params[1]).toBe('v1');
      expect(db.updates[1].params[1]).toBe('v2');

      // Verificar que no entró por FIFO
      expect(db.getAllAsync).toHaveBeenCalledTimes(0);
    });

    it('funciona con array vacío (no hace nada)', async () => {
      await marcarComoPagado(db, { ventaIds: [] });

      expect(db.runAsync).toHaveBeenCalledTimes(0);
    });
  });

  describe('Pago parcial FIFO — 1 venta', () => {
    it('aplica pago parcial sin marcar como pagada', async () => {
      db.setPendientes([createVenta('v1', 80000, 0)]); // S/ 800

      await marcarComoPagado(db, { ventaIds: ['v1'], montoCents: 50000 }); // S/ 500

      expect(db.getAllAsync).toHaveBeenCalledTimes(1);
      expect(db.runAsync).toHaveBeenCalledTimes(1);

      // params: [pagado_cents, estado_pago, now, id]
      expect(db.updates[0].params[0]).toBe(50000);  // pagado_cents = 50000
      expect(db.updates[0].params[1]).toBe(0);       // estado_pago = 0 (sigue pendiente)
      expect(db.updates[0].params[3]).toBe('v1');    // WHERE id = ?
    });

    it('aplica pago exacto y marca como pagada', async () => {
      db.setPendientes([createVenta('v1', 80000, 0)]);

      await marcarComoPagado(db, { ventaIds: ['v1'], montoCents: 80000 });

      expect(db.updates[0].params[0]).toBe(80000);
      expect(db.updates[0].params[1]).toBe(1); // estado_pago = 1 (pagada)
    });

    it('aplica pago parcial a venta con pagado previo', async () => {
      db.setPendientes([createVenta('v1', 80000, 30000)]); // ya pagó 300

      await marcarComoPagado(db, { ventaIds: ['v1'], montoCents: 20000 }); // paga 200 más

      expect(db.updates[0].params[0]).toBe(50000); // 30000 + 20000 = 50000
      expect(db.updates[0].params[1]).toBe(0);      // sigue pendiente
    });

    it('completa venta con pago parcial exacto al saldo restante', async () => {
      db.setPendientes([createVenta('v1', 80000, 50000)]); // saldo 300

      await marcarComoPagado(db, { ventaIds: ['v1'], montoCents: 30000 });

      expect(db.updates[0].params[0]).toBe(80000); // 50000 + 30000 = 80000
      expect(db.updates[0].params[1]).toBe(1);      // pagada!
    });

    it('no procesa si montoCents es 0', async () => {
      db.setPendientes([]); // sin pendientes porque COALESCE filtraría montoCents=0

      await marcarComoPagado(db, { ventaIds: ['v1'], montoCents: 0 });

      // No debería haber updates porque no hay pendientes
      expect(db.runAsync).toHaveBeenCalledTimes(0);
    });
  });

  describe('Pago parcial FIFO — múltiples ventas', () => {
    it('distribuye pago FIFO: venta más antigua primero', async () => {
      // v1 es más antigua (fecha_venta ASC)
      db.setPendientes([
        createVenta('v1', 80000, 0),
        createVenta('v2', 50000, 0),
      ]);

      await marcarComoPagado(db, { ventaIds: ['v1', 'v2'], montoCents: 100000 }); // S/ 1000

      expect(db.runAsync).toHaveBeenCalledTimes(2);

      // params: [pagado_cents, estado_pago, now, id]
      // v1 se paga primero (más antigua)
      expect(db.updates[0].params[0]).toBe(80000);  // v1: pagado_cents = 80000
      expect(db.updates[0].params[1]).toBe(1);       // v1: estado_pago = 1
      expect(db.updates[0].params[3]).toBe('v1');    // WHERE id = ?

      // v2 recibe el resto: remaining = 100000 - 80000 = 20000
      expect(db.updates[1].params[0]).toBe(20000);  // v2: pagado_cents = 20000
      expect(db.updates[1].params[1]).toBe(0);       // v2: estado_pago = 0
      expect(db.updates[1].params[3]).toBe('v2');    // WHERE id = ?
    });

    it('no paga más del saldo de cada venta', async () => {
      db.setPendientes([
        createVenta('v1', 30000, 0),
        createVenta('v2', 30000, 0),
      ]);

      await marcarComoPagado(db, { ventaIds: ['v1', 'v2'], montoCents: 50000 }); // S/ 500

      expect(db.runAsync).toHaveBeenCalledTimes(2);

      // params: [pagado_cents, estado_pago, now, id]
      // v1: saldo=30000, abono=min(30000,50000)=30000
      expect(db.updates[0].params[0]).toBe(30000);
      expect(db.updates[0].params[1]).toBe(1); // pagada

      // v2: saldo=30000, remaining=50000-30000=20000, abono=20000
      expect(db.updates[1].params[0]).toBe(20000);
      expect(db.updates[1].params[1]).toBe(0); // pendiente
    });

    it('detiene distribución cuando remaining llega a 0', async () => {
      db.setPendientes([
        createVenta('v1', 10000, 0),
        createVenta('v2', 50000, 0),
        createVenta('v3', 50000, 0),
      ]);

      await marcarComoPagado(db, { ventaIds: ['v1', 'v2', 'v3'], montoCents: 15000 });

      expect(db.runAsync).toHaveBeenCalledTimes(2); // solo v1 y v2

      expect(db.updates[0].params[0]).toBe(10000); // v1 pagada
      expect(db.updates[0].params[3]).toBe('v1');
      expect(db.updates[1].params[0]).toBe(5000);  // v2 parcial
      expect(db.updates[1].params[3]).toBe('v2');
    });
  });
});
