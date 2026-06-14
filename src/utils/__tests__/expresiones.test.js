import {
  parsearTerminos,
  terminoAString,
  calcularTotalTerminos,
  simplificarExpresion,
  normalizarExpresion,
} from '../expresiones';

describe('parsearTerminos', () => {
  it('parsea expresión simple sin multiplicación', () => {
    const result = parsearTerminos('30');
    expect(result).toEqual([{ multiplicando: 30, multiplicador: null }]);
  });

  it('parsea expresión con multiplicación', () => {
    const result = parsearTerminos('30x3');
    expect(result).toEqual([{ multiplicando: 30, multiplicador: 3 }]);
  });

  it('parsea expresión compuesta', () => {
    const result = parsearTerminos('30x3+15');
    expect(result).toEqual([
      { multiplicando: 30, multiplicador: 3 },
      { multiplicando: 15, multiplicador: null },
    ]);
  });

  it('parsea múltiples términos con multiplicación', () => {
    const result = parsearTerminos('25x2+30x3+15');
    expect(result).toEqual([
      { multiplicando: 25, multiplicador: 2 },
      { multiplicando: 30, multiplicador: 3 },
      { multiplicando: 15, multiplicador: null },
    ]);
  });

  it('retorna array vacío para string vacío', () => {
    expect(parsearTerminos('')).toEqual([]);
  });

  it('retorna array vacío para null', () => {
    expect(parsearTerminos(null)).toEqual([]);
  });

  it('retorna array vacío para undefined', () => {
    expect(parsearTerminos(undefined)).toEqual([]);
  });
});

describe('terminoAString', () => {
  it('convierte término con multiplicador', () => {
    expect(terminoAString({ multiplicando: 30, multiplicador: 3 })).toBe('30x3');
  });

  it('convierte término sin multiplicador', () => {
    expect(terminoAString({ multiplicando: 15, multiplicador: null })).toBe('15');
  });
});

describe('calcularTotalTerminos', () => {
  it('calcula total de términos simples', () => {
    const terminos = [{ multiplicando: 30, multiplicador: null }];
    expect(calcularTotalTerminos(terminos)).toBe(30);
  });

  it('calcula total de términos con multiplicación', () => {
    const terminos = [{ multiplicando: 30, multiplicador: 3 }];
    expect(calcularTotalTerminos(terminos)).toBe(90);
  });

  it('calcula total de expresión compuesta', () => {
    const terminos = [
      { multiplicando: 30, multiplicador: 3 },
      { multiplicando: 15, multiplicador: null },
    ];
    expect(calcularTotalTerminos(terminos)).toBe(105);
  });
});

describe('simplificarExpresion', () => {
  it('simplifica: mismo multiplicando → factoriza (30x3 + 30 = 30x4)', () => {
    const result = simplificarExpresion('30x3', '30');
    expect(result.expresion).toBe('30x4');
    expect(result.total).toBe(120);
  });

  it('simplifica: 30x3 + 30x2 = 30x5', () => {
    const result = simplificarExpresion('30x3', '30x2');
    expect(result.expresion).toBe('30x5');
    expect(result.total).toBe(150);
  });

  it('no simplifica: diferente multiplicando (30x3 + 15x2)', () => {
    const result = simplificarExpresion('30x3', '15x2');
    expect(result.expresion).toBe('30x3+15x2');
    expect(result.total).toBe(120);
  });

  it('no simplifica: 30x3 + 25', () => {
    const result = simplificarExpresion('30x3', '25');
    expect(result.expresion).toBe('30x3+25');
    expect(result.total).toBe(115);
  });

  it('maneja exprA vacía', () => {
    const result = simplificarExpresion('', '30');
    expect(result.expresion).toBe('30');
    expect(result.total).toBe(0);
  });

  it('maneja exprB vacía', () => {
    const result = simplificarExpresion('30x3', '');
    expect(result.expresion).toBe('30x3');
    expect(result.total).toBe(0);
  });

  it('maneja ambas vacías', () => {
    const result = simplificarExpresion('', '');
    expect(result.expresion).toBe('');
    expect(result.total).toBe(0);
  });

  it('simplifica: 25x2 + 25 = 25x3', () => {
    const result = simplificarExpresion('25x2', '25');
    expect(result.expresion).toBe('25x3');
    expect(result.total).toBe(75);
  });

  it('simplifica: 15x5 + 15x3 = 15x8', () => {
    const result = simplificarExpresion('15x5', '15x3');
    expect(result.expresion).toBe('15x8');
    expect(result.total).toBe(120);
  });

  it('simplifica con múltiples términos en exprA', () => {
    const result = simplificarExpresion('30x3+30', '30');
    expect(result.expresion).toBe('30x5'); // 3+1+1 = 5
    expect(result.total).toBe(150);
  });

  it('no simplifica si hay mezcla de multiplicandos en exprA', () => {
    const result = simplificarExpresion('30x3+15', '30');
    expect(result.expresion).toContain('30x3');
    expect(result.expresion).toContain('15');
    expect(result.expresion).toContain('30'); // el 30 suelto
  });
});

describe('normalizarExpresion', () => {
  it('normaliza: 30x3+30 → 30x4', () => {
    expect(normalizarExpresion('30x3+30')).toBe('30x4');
  });

  it('normaliza: 30x3+30+15x2+15 → 30x4+15x3', () => {
    const result = normalizarExpresion('30x3+30+15x2+15');
    expect(result).toContain('30x4');
    expect(result).toContain('15x3');
  });

  it('normaliza: 30+30+30 → 30x3', () => {
    expect(normalizarExpresion('30+30+30')).toBe('30x3');
  });

  it('normaliza: 30+30x2+30x3 → 30x6', () => {
    expect(normalizarExpresion('30+30x2+30x3')).toBe('30x6');
  });

  it('retorna string vacío para entrada vacía', () => {
    expect(normalizarExpresion('')).toBe('');
  });

  it('retorna string vacío para null', () => {
    expect(normalizarExpresion(null)).toBe('');
  });

  it('mantiene expresión ya simplificada', () => {
    expect(normalizarExpresion('30x4')).toBe('30x4');
  });

  it('mantiene expresión sin simplificar si no aplica', () => {
    expect(normalizarExpresion('30x3+15x2')).toContain('30x3');
    expect(normalizarExpresion('30x3+15x2')).toContain('15x2');
  });
});
