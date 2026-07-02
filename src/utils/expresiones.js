/**
 * Utilidades para manejo de expresiones de cantidad del POS.
 *
 * Una "expresión" representa cantidades con multiplicación y suma,
 * ej: "30x3+15" significa (30 copias × 3 originales) + 15 copias = 105 unidades.
 *
 * La simplificación detecta cuando todos los términos comparten el mismo
 * multiplicando y los factoriza: "30x3+30x1" → "30x4".
 */

/**
 * Parsea un término individual (una parte de la expresión separada por +).
 * Ej: "30x3" → { multiplicando: 30, multiplicador: 3 }
 *     "30"   → { multiplicando: 30, multiplicador: null }
 *     "15x2" → { multiplicando: 15, multiplicador: 2 }
 *
 * @param {string} termStr - String del término (ej: "30x3")
 * @returns {{ multiplicando: number, multiplicador: number|null }}
 */
function parsearTermino(termStr) {
  const partes = termStr.split('x');
  const multiplicando = parseInt(partes[0], 10);
  if (isNaN(multiplicando) || multiplicando <= 0) return null;

  if (partes.length >= 2) {
    const multiplicador = parseInt(partes[1], 10);
    if (isNaN(multiplicador) || multiplicador <= 0) return null;
    return { multiplicando, multiplicador };
  }

  return { multiplicando, multiplicador: null };
}

/**
 * Parsea una expresión completa en un array de términos.
 * Ej: "30x3+15" → [{multiplicando:30, multiplicador:3}, {multiplicando:15, multiplicador:null}]
 *
 * @param {string} exprStr - Expresión compuesta (ej: "30x3+15")
 * @returns {Array<{multiplicando: number, multiplicador: number|null}>}
 */
export function parsearTerminos(exprStr) {
  if (!exprStr) return [];
  return exprStr
    .split('+')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => parsearTermino(t))
    .filter((t) => t !== null);
}

/**
 * Convierte un término a su representación textual.
 * Ej: {multiplicando:30, multiplicador:3} → "30x3"
 *     {multiplicando:15, multiplicador:null} → "15"
 *
 * @param {{ multiplicando: number, multiplicador: number|null }} term
 * @returns {string}
 */
export function terminoAString(term) {
  if (term.multiplicador != null) {
    return `${term.multiplicando}x${term.multiplicador}`;
  }
  return `${term.multiplicando}`;
}

/**
 * Calcula el total de unidades de un array de términos.
 * Ej: [{multiplicando:30, multiplicador:3}, {multiplicando:15, multiplicador:null}]
 *     → 30*3 + 15 = 105
 *
 * @param {Array<{multiplicando: number, multiplicador: number|null}>} terminos
 * @returns {number}
 */
export function calcularTotalTerminos(terminos) {
  return terminos.reduce((total, t) => {
    return total + (t.multiplicador != null ? t.multiplicando * t.multiplicador : t.multiplicando);
  }, 0);
}

/**
 * Intenta simplificar dos expresiones combinadas.
 *
 * Regla: si todos los términos (de ambas expresiones) tienen el mismo
 * multiplicando, se factorizan en una sola multiplicación.
 *
 * Ej: "30x3" + "30"   → "30x4"  (porque 30×3 + 30 = 30×4)
 *     "30x3" + "15x2" → "30x3+15x2" (no se puede, 30 ≠ 15)
 *     "30x3" + "30x2" → "30x5"
 *
 * @param {string} exprA - Primera expresión (ej: "30x3")
 * @param {string} exprB - Segunda expresión a combinar (ej: "30")
 * @returns {{ expresion: string, total: number }}
 *   expresion: la expresión simplificada o concatenada
 *   total: el total de unidades calculado
 */
export function simplificarExpresion(exprA, exprB) {
  if (!exprA && !exprB) return { expresion: '', total: 0 };
  if (!exprA) return { expresion: exprB, total: 0 };
  if (!exprB) return { expresion: exprA, total: 0 };

  const terminosA = parsearTerminos(exprA);
  const terminosB = parsearTerminos(exprB);
  const todosLosTerminos = [...terminosA, ...terminosB];

  if (todosLosTerminos.length === 0) {
    return { expresion: '', total: 0 };
  }

  // Calcular total
  const total = calcularTotalTerminos(todosLosTerminos);

  // Verificar si todos los términos tienen el mismo multiplicando
  const primerMultiplicando = todosLosTerminos[0].multiplicando;
  const todosIguales = todosLosTerminos.every((t) => t.multiplicando === primerMultiplicando);

  if (todosIguales) {
    // Simplificar: sumar todos los multiplicadores (tratando null como 1)
    const sumaMultiplicadores = todosLosTerminos.reduce((sum, t) => {
      return sum + (t.multiplicador != null ? t.multiplicador : 1);
    }, 0);
    return {
      expresion: `${primerMultiplicando}x${sumaMultiplicadores}`,
      total,
    };
  }

  // No se puede simplificar → concatenar normal (filtrando arrays vacíos)
  const partes = [];
  if (terminosA.length) partes.push(terminosA.map((t) => terminoAString(t)).join('+'));
  if (terminosB.length) partes.push(terminosB.map((t) => terminoAString(t)).join('+'));
  const exprStr = partes.join('+');

  return { expresion: exprStr, total };
}

/**
 * Simplifica una expresión completa aplicando la regla de factorización
 * sobre todos sus términos internos.
 *
 * Útil para limpiar expresiones existentes que ya están en la BD
 * y que fueron concatenadas sin simplificar.
 *
 * Ej: "30x3+30+15x2+15" → "30x4+15x3" (30 se repite 4 veces, 15 se repite 3 veces...)
 *     En realidad: [{30,3}, {30,null}, {15,2}, {15,null}]
 *     → agrupar por multiplicando: 30: [3,1] = 4, 15: [2,1] = 3
 *     → "30x4+15x3"
 *
 * @param {string} exprStr - Expresión a normalizar (ej: "30x3+30+15x2+15")
 * @returns {string} Expresión normalizada/simplificada
 */
export function normalizarExpresion(exprStr) {
  if (!exprStr) return '';

  const terminos = parsearTerminos(exprStr);
  if (terminos.length === 0) return '';

  // Agrupar por multiplicando
  const grupos = {};
  for (const t of terminos) {
    if (!grupos[t.multiplicando]) {
      grupos[t.multiplicando] = 0;
    }
    grupos[t.multiplicando] += t.multiplicador != null ? t.multiplicador : 1;
  }

  // Construir expresión agrupada
  const partes = Object.entries(grupos)
    .sort(([a], [b]) => parseInt(b, 10) - parseInt(a, 10)) // de mayor a menor
    .map(([multiplicando, sumaMultiplicadores]) => {
      if (sumaMultiplicadores === 1) {
        return `${multiplicando}`;
      }
      return `${multiplicando}x${sumaMultiplicadores}`;
    });

  return partes.join('+');
}
