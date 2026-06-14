import { renderHook, act } from '@testing-library/react-native';
import useCarrito from '../useCarrito';

// ───── Mocks ───────────────────────────────────────────────────────────────

jest.mock('../../database/queries/ventas', () => ({
  insertarVenta: jest.fn().mockResolvedValue(),
}));

jest.mock('../../services/hapticService', () => ({
  hapticProductoAgregado: jest.fn(),
  hapticVentaConfirmada: jest.fn(),
  hapticBufferVacio: jest.fn(),
  hapticError: jest.fn(),
}));

jest.mock('../../services/syncWorker', () => ({
  recalcularPendientes: jest.fn().mockResolvedValue(),
}));

const { insertarVenta } = require('../../database/queries/ventas');
const {
  hapticProductoAgregado,
  hapticBufferVacio,
} = require('../../services/hapticService');

// ───── Helpers ─────────────────────────────────────────────────────────────

const mockDb = {};
const mockActualizarConteo = jest.fn();

// Producto de prueba (precio fijo)
const productoFijo = {
  id: 'prod-001',
  nombre: 'Copia B/N A4',
  precio_cents: 10,
  is_variable: 0,
  is_custom: 0,
};

// Producto variable
const productoVariable = {
  id: 'prod-002',
  nombre: 'Servicio Especial',
  precio_cents: 0,
  is_variable: 1,
  is_custom: 0,
};

// Producto personalizado
const productoCustom = {
  id: 'prod-003',
  nombre: 'Caso Especial',
  precio_cents: 0,
  is_variable: 0,
  is_custom: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ───── Tests ───────────────────────────────────────────────────────────────

describe('useCarrito — Estado inicial', () => {
  it('debe iniciar con el carrito vacío y total 0', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    expect(result.current.carrito).toEqual([]);
    expect(result.current.totalCarritoCents).toBe(0);
    expect(result.current.isGuardando).toBe(false);
    expect(result.current.displayBuffer).toBe('');
    expect(result.current.isModoMultiplicacion).toBe(false);
  });

  it('debe mostrar displayBuffer vacío cuando no hay dígitos', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    expect(result.current.displayBuffer).toBe('');
  });
});

describe('useCarrito — Lógica del pad numérico', () => {
  it('debe agregar dígitos al buffer con handleNumberPress', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleNumberPress('7'));

    expect(result.current.displayBuffer).toBe('37');
  });

  it('debe activar modo multiplicación con handleXPress', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleXPress());

    expect(result.current.isModoMultiplicacion).toBe(true);
    expect(result.current.displayBuffer).toBe('3×');
  });

  it('debe mostrar multiplicación en el buffer', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleXPress());
    act(() => result.current.handleNumberPress('5'));

    expect(result.current.displayBuffer).toBe('3×5');
    expect(result.current.isModoMultiplicacion).toBe(true);
  });

  it('debe mostrar expresión compuesta con +', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleXPress());
    act(() => result.current.handleNumberPress('5'));
    act(() => result.current.handlePlusPress()); // + finaliza 3×5
    act(() => result.current.handleNumberPress('1'));
    act(() => result.current.handleNumberPress('5'));

    expect(result.current.displayBuffer).toBe('3×5 + 15');
  });

  it('debe mostrar expresión con múltiples términos', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleXPress());
    act(() => result.current.handleNumberPress('5'));
    act(() => result.current.handlePlusPress()); // 3×5
    act(() => result.current.handleNumberPress('1'));
    act(() => result.current.handleNumberPress('5'));
    act(() => result.current.handlePlusPress()); // 15
    act(() => result.current.handleNumberPress('2'));
    act(() => result.current.handleXPress());
    act(() => result.current.handleNumberPress('4')); // 2×4

    expect(result.current.displayBuffer).toBe('3×5 + 15 + 2×4');
  });

  it('handleBackspace debe borrar el último dígito', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('1'));
    act(() => result.current.handleNumberPress('2'));
    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleBackspace());

    expect(result.current.displayBuffer).toBe('12');
  });

  it('handleBackspace debe salir de modo multiplicación si multiplicador está vacío', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleXPress());

    expect(result.current.isModoMultiplicacion).toBe(true);

    act(() => result.current.handleBackspace());
    expect(result.current.isModoMultiplicacion).toBe(false);
    expect(result.current.displayBuffer).toBe('3');
  });

  it('handleBackspace debe retroceder a expresión anterior si el buffer actual está vacío', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleXPress());
    act(() => result.current.handleNumberPress('5'));
    act(() => result.current.handlePlusPress()); // 3×5 guardado
    act(() => result.current.handleNumberPress('1'));
    act(() => result.current.handleNumberPress('5'));

    // Buffer muestra: "3×5 + 15"
    act(() => result.current.handleBackspace());
    act(() => result.current.handleBackspace());
    // Ahora current está vacío → retrocede a 3×5
    act(() => result.current.handleBackspace());

    expect(result.current.displayBuffer).toBe('3×5');
  });

  it('no debe permitir más de 4 dígitos en el buffer', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('1'));
    act(() => result.current.handleNumberPress('2'));
    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleNumberPress('4'));
    act(() => result.current.handleNumberPress('5'));

    expect(result.current.displayBuffer).toBe('1234');
  });

  it('limpiarBuffer debe resetear todos los buffers y expresiones', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleXPress());
    act(() => result.current.handleNumberPress('5'));
    act(() => result.current.handlePlusPress());
    act(() => result.current.handleNumberPress('1'));
    act(() => result.current.handleXPress());
    act(() => result.current.handleNumberPress('2'));
    act(() => result.current.limpiarBuffer());

    expect(result.current.displayBuffer).toBe('');
    expect(result.current.isModoMultiplicacion).toBe(false);
  });

  it('handlePlusPress debe disparar haptic si el buffer está vacío', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    const shakeAntes = result.current.shakeSignal;
    act(() => {
      result.current.handlePlusPress();
    });

    expect(hapticBufferVacio).toHaveBeenCalled();
    expect(result.current.shakeSignal).toBe(shakeAntes + 1);
  });
});

describe('useCarrito — Agregar productos al carrito', () => {
  it('debe agregar 1 unidad si el buffer está vacío (default implícito)', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => {
      result.current.agregarAlCarrito(productoFijo);
    });

    expect(result.current.carrito).toHaveLength(1);
    expect(result.current.carrito[0].cantidad).toBe(1);
    expect(result.current.carrito[0].subtotal_cents).toBe(10);
    expect(result.current.totalCarritoCents).toBe(10);
    expect(hapticProductoAgregado).toHaveBeenCalled();
  });

  it('debe agregar la cantidad digitada en el buffer', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('5'));
    act(() => {
      result.current.agregarAlCarrito(productoFijo);
    });

    expect(result.current.carrito).toHaveLength(1);
    expect(result.current.carrito[0].cantidad).toBe(5);
    expect(result.current.carrito[0].subtotal_cents).toBe(50);
  });

  it('debe calcular multiplicación 30×3 = 90', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleNumberPress('0'));
    act(() => result.current.handleXPress());
    act(() => result.current.handleNumberPress('3'));
    act(() => {
      result.current.agregarAlCarrito(productoFijo);
    });

    expect(result.current.carrito).toHaveLength(1);
    expect(result.current.carrito[0].cantidad).toBe(90);
    expect(result.current.carrito[0].subtotal_cents).toBe(900);
    expect(result.current.carrito[0].detalle_multiplicador).toBe('30x3');
  });

  it('debe calcular expresión compuesta 30×3+15 = 105', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleNumberPress('0'));
    act(() => result.current.handleXPress());
    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handlePlusPress()); // 30×3 guardado
    act(() => result.current.handleNumberPress('1'));
    act(() => result.current.handleNumberPress('5'));
    act(() => {
      result.current.agregarAlCarrito(productoFijo);
    });

    expect(result.current.carrito).toHaveLength(1);
    expect(result.current.carrito[0].cantidad).toBe(105);
    expect(result.current.carrito[0].subtotal_cents).toBe(1050);
    expect(result.current.carrito[0].detalle_multiplicador).toBe('30x3+15');
  });

  it('debe fusionar mismo producto agregado dos veces', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    // Primera vez: 30×3 = 90
    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleNumberPress('0'));
    act(() => result.current.handleXPress());
    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.agregarAlCarrito(productoFijo));

    expect(result.current.carrito).toHaveLength(1);
    expect(result.current.carrito[0].cantidad).toBe(90);

    // Segunda vez: 15 unidades del mismo producto → fusiona
    act(() => result.current.handleNumberPress('1'));
    act(() => result.current.handleNumberPress('5'));
    act(() => result.current.agregarAlCarrito(productoFijo));

    // Debe seguir siendo 1 item, con cantidad = 90 + 15 = 105
    expect(result.current.carrito).toHaveLength(1);
    expect(result.current.carrito[0].cantidad).toBe(105);
    expect(result.current.carrito[0].subtotal_cents).toBe(1050);
    // La expresión debe ser la concatenación: "30x3+15"
    expect(result.current.carrito[0].detalle_multiplicador).toBe('30x3+15');
  });

  it('debe fusionar mismo producto con expresión compuesta más simple', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    // Primera vez: 30×3+15 = 105
    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleNumberPress('0'));
    act(() => result.current.handleXPress());
    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handlePlusPress());
    act(() => result.current.handleNumberPress('1'));
    act(() => result.current.handleNumberPress('5'));
    act(() => result.current.agregarAlCarrito(productoFijo));

    expect(result.current.carrito[0].detalle_multiplicador).toBe('30x3+15');

    // Segunda vez: 2×4 = 8 del mismo producto
    act(() => result.current.handleNumberPress('2'));
    act(() => result.current.handleXPress());
    act(() => result.current.handleNumberPress('4'));
    act(() => result.current.agregarAlCarrito(productoFijo));

    expect(result.current.carrito).toHaveLength(1);
    expect(result.current.carrito[0].cantidad).toBe(105 + 8);
    expect(result.current.carrito[0].detalle_multiplicador).toBe('30x3+15+2x4');
  });

  it('debe limpiar el buffer después de agregar un producto', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('5'));
    act(() => {
      result.current.agregarAlCarrito(productoFijo);
    });

    expect(result.current.displayBuffer).toBe('');
  });

  it('debe agregar múltiples productos diferentes al carrito', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    const producto2 = { ...productoFijo, id: 'prod-002', nombre: 'Impresión Color' };

    act(() => result.current.agregarAlCarrito(productoFijo));
    act(() => result.current.agregarAlCarrito(producto2));

    expect(result.current.carrito).toHaveLength(2);
  });

  it('debe retornar needsCustom para productos personalizados', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    let retorno;
    act(() => {
      retorno = result.current.agregarAlCarrito(productoCustom);
    });

    expect(retorno).toEqual({
      needsCustom: true,
      producto: productoCustom,
      totalUnidades: 1,
      multiplicadorInfo: null,
    });
    expect(result.current.carrito).toHaveLength(0);
  });

  it('debe retornar needsPrice para productos de precio variable', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    let retorno;
    act(() => {
      retorno = result.current.agregarAlCarrito(productoVariable);
    });

    expect(retorno).toHaveProperty('needsPrice', true);
    expect(result.current.carrito).toHaveLength(0);
  });

  it('debe pasar totalUnidades y multiplicadorInfo para productos custom', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('3'));
    act(() => result.current.handleXPress());
    act(() => result.current.handleNumberPress('5'));

    let retorno;
    act(() => {
      retorno = result.current.agregarAlCarrito(productoCustom);
    });

    expect(retorno).toMatchObject({
      needsCustom: true,
      totalUnidades: 15,
      multiplicadorInfo: '3x5',
    });
  });
});

describe('useCarrito — agrega con precio y custom', () => {
  it('agregarAlCarritoConPrecio debe agregar item con precio personalizado', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => {
      result.current.agregarAlCarritoConPrecio({
        producto: productoVariable,
        totalUnidades: 3,
        multiplicadorInfo: null,
        precioUnitarioCents: 150,
      });
    });

    expect(result.current.carrito).toHaveLength(1);
    expect(result.current.carrito[0].subtotal_cents).toBe(450);
  });

  it('agregarAlCarritoCustom debe agregar item con nombre y precio personalizados', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => {
      result.current.agregarAlCarritoCustom({
        producto: productoCustom,
        nombreCustom: 'Anillado especial',
        totalUnidades: 2,
        multiplicadorInfo: '2x1',
        precioUnitarioCents: 500,
      });
    });

    expect(result.current.carrito).toHaveLength(1);
    expect(result.current.carrito[0].producto_nombre).toBe('Anillado especial');
    expect(result.current.carrito[0].subtotal_cents).toBe(1000);
  });
});

describe('useCarrito — Quitar y limpiar carrito', () => {
  it('debe eliminar un item del carrito por su id', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.agregarAlCarrito(productoFijo));

    const itemId = result.current.carrito[0].id;
    act(() => {
      result.current.quitarDelCarrito(itemId);
    });

    expect(result.current.carrito).toHaveLength(0);
  });

  it('limpiarCarrito debe vaciar el carrito y el buffer', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('5'));
    act(() => result.current.agregarAlCarrito(productoFijo));
    act(() => result.current.limpiarCarrito());

    expect(result.current.carrito).toHaveLength(0);
    expect(result.current.displayBuffer).toBe('');
    expect(result.current.totalCarritoCents).toBe(0);
  });
});

describe('useCarrito — Buffer inválido', () => {
  it('debe disparar haptic y shake si el multiplicando es 0', () => {
    const { result } = renderHook(() => useCarrito(mockDb, mockActualizarConteo));

    act(() => result.current.handleNumberPress('0'));

    const shakeAntes = result.current.shakeSignal;
    act(() => {
      result.current.agregarAlCarrito(productoFijo);
    });

    expect(hapticBufferVacio).toHaveBeenCalled();
    expect(result.current.shakeSignal).toBe(shakeAntes + 1);
    expect(result.current.carrito).toHaveLength(0);
  });
});
