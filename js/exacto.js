// ============================================================================
// CÁLCULO EXACTO (código propio, sin dependencias)
// Fracciones, raíces cuadradas y π. Un valor exacto es una suma de términos
//     (a/b) · √n · π^k      con n entero ≥ 1 libre de cuadrados y k entero,
// guardada como Map "n|k" → racional (BigInt). Así √20 es 2√5, 1/√2 es √2/2 y
// 3/4 + 1/6 es 11/12. Cuando una operación no tiene resultado en esta forma
// (√π, ln 2, sen de 0.3 rad…) se lanza NoExacto y el que llama vuelve al
// cálculo decimal. Lo usa FORMULAS.calcular(…, { exacto: true }).
//
//   EXACTO.evaluarArbol(arbol, set)  → valor exacto (o lanza NoExacto / Error)
//   EXACTO.formatear(valor)          → { latex, texto } o null si se pidió decimal()
//   unsimplify(x): muestra √20 en vez de 2√5 (y 1/√37 en vez de √37/37)
//   simplify(x):   forma simplificada (la de por defecto)
//   decimal(x):    fuerza el decimal aunque la pregunta sea exacta
// ============================================================================
'use strict';

const EXACTO = (() => {
  class NoExacto extends Error {}

  // ---------- racionales (BigInt) ----------
  const B = (x) => BigInt(x);
  function gcd(a, b) {
    a = a < 0n ? -a : a; b = b < 0n ? -b : b;
    while (b) { [a, b] = [b, a % b]; }
    return a;
  }
  function rac(num, den) {
    num = B(num); den = den == null ? 1n : B(den);
    if (den === 0n) throw new Error('División por cero');
    if (den < 0n) { num = -num; den = -den; }
    const g = gcd(num, den) || 1n;
    return { num: num / g, den: den / g };
  }
  const rSum = (a, b) => rac(a.num * b.den + b.num * a.den, a.den * b.den);
  const rMul = (a, b) => rac(a.num * b.num, a.den * b.den);
  const rNeg = (a) => ({ num: -a.num, den: a.den });
  const rDiv = (a, b) => { if (b.num === 0n) throw new Error('División por cero'); return rac(a.num * b.den, a.den * b.num); };
  const rCero = (a) => a.num === 0n;
  const rFloat = (a) => Number(a.num) / Number(a.den);

  // "2,5", "0.1", "1e-3", "-7" → racional exacto (sin pasar por coma flotante)
  function racionalDesdeTexto(s) {
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(',', '.');
    const m = /^([-+]?)(\d*)(?:\.(\d*))?(?:[eE]([-+]?\d+))?$/.exec(s);
    if (!m || (m[2] === '' && (m[3] == null || m[3] === ''))) return null;
    const ent = m[2] || '0', dec = m[3] || '';
    let num = B(ent + dec), den = 10n ** B(dec.length);
    const e = m[4] ? parseInt(m[4], 10) : 0;
    if (e > 0) num *= 10n ** B(e); else if (e < 0) den *= 10n ** B(-e);
    if (m[1] === '-') num = -num;
    return rac(num, den);
  }

  // ---------- enteros: parte cuadrada ----------
  const LIMITE = 10n ** 12n;
  function descomponer(n) {       // n ≥ 1 → n = fuera² · dentro, dentro libre de cuadrados
    if (n > LIMITE) throw new NoExacto('radicando demasiado grande');
    let fuera = 1n, dentro = 1n, m = n;
    for (let p = 2n; p * p <= m; p += (p === 2n ? 1n : 2n)) {
      if (m % p) continue;
      let e = 0;
      while (m % p === 0n) { m /= p; e++; }
      if (e >> 1) fuera *= p ** B(e >> 1);
      if (e & 1) dentro *= p;
    }
    return { fuera, dentro: dentro * m };
  }
  function raizEntera(n) {        // ⌊√n⌋ para BigInt ≥ 0
    if (n < 2n) return n;
    let x = B(Math.floor(Math.sqrt(Number(n))));
    while (x * x > n) x--;
    while ((x + 1n) * (x + 1n) <= n) x++;
    return x;
  }
  const esCuadrado = (n) => { const r = raizEntera(n); return r * r === n ? r : null; };

  // ---------- valores: suma de términos ----------
  const clave = (n, k) => n.toString() + '|' + k;
  const descl = (c) => { const i = c.indexOf('|'); return { n: B(c.slice(0, i)), k: parseInt(c.slice(i + 1), 10) }; };
  function valor(terminos) {
    const t = new Map();
    for (const [c, q] of terminos) if (!rCero(q)) t.set(c, q);
    return { t };
  }
  function termino(q, n, k) {
    const { fuera, dentro } = descomponer(n == null ? 1n : B(n));
    return valor(new Map([[clave(dentro, k || 0), rMul(q, rac(fuera))]]));
  }
  const deRacional = (q) => valor(new Map([[clave(1n, 0), q]]));
  const deEntero = (n) => deRacional(rac(n));
  const CERO = deEntero(0), UNO = deEntero(1), PI = termino(rac(1), 1n, 1);
  const copiar = (a, extra) => Object.assign({ t: a.t }, extra || {});

  function sumar(a, b) {
    const t = new Map(a.t);
    for (const [c, q] of b.t) t.set(c, t.has(c) ? rSum(t.get(c), q) : q);
    return valor(t);
  }
  function negar(a) { const t = new Map(); for (const [c, q] of a.t) t.set(c, rNeg(q)); return { t }; }
  const restar = (a, b) => sumar(a, negar(b));
  function multiplicar(a, b) {
    let acc = CERO;
    for (const [ca, qa] of a.t) for (const [cb, qb] of b.t) {
      const A = descl(ca), Bb = descl(cb);
      acc = sumar(acc, termino(rMul(qa, qb), A.n * Bb.n, A.k + Bb.k));
    }
    return acc;
  }
  const esCero = (a) => a.t.size === 0;
  const esRacional = (a) => a.t.size === 0 || (a.t.size === 1 && a.t.has(clave(1n, 0)));
  function comoRacional(a) {
    if (!esRacional(a)) throw new NoExacto('se necesita un número racional');
    return a.t.get(clave(1n, 0)) || rac(0);
  }
  function aFloat(a) {
    let s = 0;
    for (const [c, q] of a.t) { const { n, k } = descl(c); s += rFloat(q) * Math.sqrt(Number(n)) * Math.pow(Math.PI, k); }
    return s;
  }
  function inverso(b) {
    if (esCero(b)) throw new Error('División por cero');
    const ts = [...b.t];
    if (ts.length === 1) {               // 1/(q√n π^k) = (1/(q·n)) √n π^(−k)
      const [c, q] = ts[0]; const { n, k } = descl(c);
      return termino(rDiv(rac(1), rMul(q, rac(n))), n, -k);
    }
    if (ts.length === 2) {               // conjugado: 1/(x+y) = (x−y)/(x²−y²) si queda racional
      const [[c1, q1], [c2, q2]] = ts;
      if (descl(c1).k !== 0 || descl(c2).k !== 0) throw new NoExacto('división por una suma con π');
      const conj = valor(new Map([[c1, q1], [c2, rNeg(q2)]]));
      const den = multiplicar(b, conj);
      if (!esRacional(den)) throw new NoExacto('división por una suma de raíces');
      return multiplicar(conj, deRacional(rDiv(rac(1), comoRacional(den))));
    }
    throw new NoExacto('división por una suma de varios términos');
  }
  const dividir = (a, b) => multiplicar(a, inverso(b));

  function raiz(a) {
    if (esCero(a)) return CERO;
    if (aFloat(a) < 0) throw new Error('Raíz cuadrada de un número negativo');
    const ts = [...a.t];
    if (ts.length === 1) {
      const [c, q] = ts[0]; const { n, k } = descl(c);
      if (n !== 1n || k % 2 !== 0) throw new NoExacto('raíz de una raíz o de π');
      return termino(rac(1, q.den), q.num * q.den, k / 2);   // √(p/q) = √(p·q)/q
    }
    if (ts.length === 2) {               // desanidar √(x + y√n) = √((x+c)/2) ± √((x−c)/2), c = √(x² − y²n)
      let [[c1, q1], [c2, q2]] = ts;
      if (descl(c1).n !== 1n) { [c1, q1, c2, q2] = [c2, q2, c1, q1]; }
      const A = descl(c1), Bb = descl(c2);
      if (A.n === 1n && A.k === 0 && Bb.k === 0) {
        const x = q1, d = rSum(rMul(x, x), rNeg(rMul(rMul(q2, q2), rac(Bb.n))));
        if (rFloat(d) >= 0) {
          const sq = esCuadrado(d.num * d.den);
          if (sq !== null) {
            const cr = rac(sq, d.den);
            const p1 = rMul(rSum(x, cr), rac(1, 2)), p2 = rMul(rSum(x, rNeg(cr)), rac(1, 2));
            if (rFloat(p1) >= 0 && rFloat(p2) >= 0) {
              let r = sumar(raiz(deRacional(p1)), q2.num < 0n ? negar(raiz(deRacional(p2))) : raiz(deRacional(p2)));
              const obj = aFloat(a);
              if (Math.abs(aFloat(multiplicar(r, r)) - obj) <= 1e-9 * Math.max(1, Math.abs(obj))) return r;
            }
          }
        }
      }
    }
    throw new NoExacto('raíz sin forma exacta');
  }

  function raizEnesima(q, k) {         // raíz k-ésima exacta de un racional, o null
    const neg = q.num < 0n;
    if (neg && k % 2n === 0n) throw new Error('Raíz de índice par de un número negativo');
    const abs = neg ? -q.num : q.num;
    const aprox = (v) => { const r = B(Math.round(Math.pow(Number(v), 1 / Number(k)))); for (const c of [r - 1n, r, r + 1n]) if (c >= 0n && c ** k === v) return c; return null; };
    const rn = aprox(abs), rd = aprox(q.den);
    if (rn === null || rd === null) return null;
    return deRacional(rac(neg ? -rn : rn, rd));
  }
  function potencia(a, e) {
    const er = comoRacional(e);
    if (er.den === 1n) {
      let n = er.num, base = a;
      if (n < 0n) { base = inverso(a); n = -n; }
      let r = UNO;
      while (n > 0n) { if (n & 1n) r = multiplicar(r, base); base = multiplicar(base, base); n >>= 1n; }
      return r;
    }
    if (er.den === 2n) return potencia(raiz(a), deEntero(er.num));
    if (esRacional(a)) {
      const r = raizEnesima(comoRacional(a), er.den);
      if (r) return potencia(r, deEntero(er.num));
    }
    throw new NoExacto('potencia fraccionaria sin forma exacta');
  }

  // ---------- trigonometría exacta ----------
  // Fila: ángulo de referencia en grados (g), su nombre, y sen/cos/tan exactos
  // (null = no tiene forma exacta en este sistema; tan undefined = no definida).
  const S = (n) => termino(rac(1), n, 0);
  const fr = (num, den) => deRacional(rac(num, den));
  const mul = (q, v) => multiplicar(deRacional(q), v);
  const deg = (x) => Math.atan(x) * 180 / Math.PI;
  const TABLA = [
    { g: 0,        nombre: '0°',    sen: CERO, cos: UNO, tan: CERO },
    { g: deg(1 / 12), nombre: '4.8°',  gr: rac(48, 10),  sen: mul(rac(1, 145), S(145n)), cos: mul(rac(12, 145), S(145n)), tan: fr(1, 12) },
    { g: deg(1 / 6),  nombre: '9.5°',  gr: rac(95, 10),  sen: mul(rac(1, 37), S(37n)),   cos: mul(rac(6, 37), S(37n)),    tan: fr(1, 6) },
    { g: 15,       nombre: '15°',   sen: mul(rac(1, 4), restar(S(6n), S(2n))), cos: mul(rac(1, 4), sumar(S(6n), S(2n))), tan: restar(deEntero(2), S(3n)) },
    { g: 18,       nombre: '18°',   sen: mul(rac(1, 4), restar(S(5n), UNO)), cos: null, tan: null },
    { g: deg(1 / 3),  nombre: '18.4°', gr: rac(184, 10), sen: mul(rac(1, 10), S(10n)),   cos: mul(rac(3, 10), S(10n)),    tan: fr(1, 3) },
    { g: 30,       nombre: '30°',   sen: fr(1, 2), cos: mul(rac(1, 2), S(3n)), tan: mul(rac(1, 3), S(3n)) },
    { g: 36,       nombre: '36°',   sen: null, cos: mul(rac(1, 4), sumar(UNO, S(5n))), tan: null },
    { g: deg(3 / 4),  nombre: '36.9°', gr: rac(369, 10), sen: fr(3, 5), cos: fr(4, 5), tan: fr(3, 4) },
    { g: 45,       nombre: '45°',   sen: mul(rac(1, 2), S(2n)), cos: mul(rac(1, 2), S(2n)), tan: UNO },
    { g: deg(4 / 3),  nombre: '53.1°', gr: rac(531, 10), sen: fr(4, 5), cos: fr(3, 5), tan: fr(4, 3) },
    { g: 54,       nombre: '54°',   sen: mul(rac(1, 4), sumar(UNO, S(5n))), cos: null, tan: null },
    { g: 60,       nombre: '60°',   sen: mul(rac(1, 2), S(3n)), cos: fr(1, 2), tan: S(3n) },
    { g: deg(3),      nombre: '71.6°', gr: rac(716, 10), sen: mul(rac(3, 10), S(10n)),   cos: mul(rac(1, 10), S(10n)),    tan: deEntero(3) },
    { g: 72,       nombre: '72°',   sen: null, cos: mul(rac(1, 4), restar(S(5n), UNO)), tan: null },
    { g: 75,       nombre: '75°',   sen: mul(rac(1, 4), sumar(S(6n), S(2n))), cos: mul(rac(1, 4), restar(S(6n), S(2n))), tan: sumar(deEntero(2), S(3n)) },
    { g: deg(6),      nombre: '80.5°', gr: rac(805, 10), sen: mul(rac(6, 37), S(37n)),   cos: mul(rac(1, 37), S(37n)),    tan: deEntero(6) },
    { g: deg(12),     nombre: '85.2°', gr: rac(852, 10), sen: mul(rac(12, 145), S(145n)), cos: mul(rac(1, 145), S(145n)), tan: deEntero(12) },
    { g: 90,       nombre: '90°',   sen: UNO, cos: CERO, tan: undefined },
  ];
  const TOLERANCIA_GRADOS = 0.06;   // los ángulos de la tabla van redondeados a un decimal
  const TOL = 1e-9;

  function trigGrados(fn, a) {
    const gr = comoRacional(a);
    let d = rFloat(gr) % 360; if (d < 0) d += 360;
    let ref, sSen, sCos;
    if (d <= 90) { ref = d; sSen = 1; sCos = 1; }
    else if (d <= 180) { ref = 180 - d; sSen = 1; sCos = -1; }
    else if (d <= 270) { ref = d - 180; sSen = -1; sCos = -1; }
    else { ref = 360 - d; sSen = -1; sCos = 1; }
    const fila = TABLA.find((f) => Math.abs(f.g - ref) <= TOLERANCIA_GRADOS);
    if (!fila) throw new NoExacto('ángulo sin valor exacto en la tabla');
    const signo = (s, v) => (s < 0 ? negar(v) : v);
    if (fn === 'sin') { if (!fila.sen) throw new NoExacto(`el seno de ${fila.nombre} no tiene forma exacta`); return signo(sSen, fila.sen); }
    if (fn === 'cos') { if (!fila.cos) throw new NoExacto(`el coseno de ${fila.nombre} no tiene forma exacta`); return signo(sCos, fila.cos); }
    if (fila.tan === undefined) throw new Error('Tangente no definida');
    if (!fila.tan) throw new NoExacto(`la tangente de ${fila.nombre} no tiene forma exacta`);
    return signo(sSen * sCos, fila.tan);
  }
  function trigRad(fn, a) {            // el ángulo debe ser 0 o un múltiplo racional de π
    if (esCero(a)) return trigGrados(fn, CERO);
    const ts = [...a.t];
    if (ts.length === 1) {
      const [c, q] = ts[0]; const { n, k } = descl(c);
      if (n === 1n && k === 1) return trigGrados(fn, deRacional(rMul(q, rac(180))));
    }
    throw new NoExacto('ángulo en radianes sin forma exacta (escríbelo como múltiplo de pi o usa sind/cosd/tand)');
  }
  // Inversas: devuelven el ángulo de la tabla (exacto o el redondeado a un decimal)
  function gradosDeFila(f) { return f.gr ? deRacional(f.gr) : deEntero(f.g); }
  function inversaGrados(fn, x) {
    const v = aFloat(x);
    const campo = { asin: 'sen', acos: 'cos', atan: 'tan' }[fn];
    for (const f of TABLA) {
      const ex = f[campo];
      if (!ex) continue;
      if (Math.abs(aFloat(ex) - Math.abs(v)) <= TOL) {
        const g = gradosDeFila(f);
        if (fn === 'acos') return v < 0 ? restar(deEntero(180), g) : g;
        return v < 0 ? negar(g) : g;
      }
    }
    throw new NoExacto('valor sin ángulo exacto en la tabla');
  }
  function inversaRad(fn, x) {
    const g = inversaGrados(fn, x);
    if (!esRacional(g)) throw new NoExacto('ángulo sin forma exacta');
    const q = comoRacional(g);
    const f = TABLA.find((f) => f.gr && Math.abs(rFloat(f.gr) - Math.abs(rFloat(q))) < 1e-9 || (f.gr && Math.abs(180 - rFloat(f.gr) - rFloat(q)) < 1e-9));
    if (f) throw new NoExacto('ese ángulo solo es exacto en grados (usa asind/acosd/atand)');
    return multiplicar(deRacional(rDiv(q, rac(180))), PI);
  }

  // ---------- funciones ----------
  function redondear(a, n) {           // round(x, n) → racional con n decimales
    const dec = Math.max(0, Math.min(8, Math.round(aFloat(n || CERO))));
    const f = 10n ** B(dec);
    const q = comoRacional(a);
    const num = q.num * f, den = q.den;
    const neg = num < 0n; const absn = neg ? -num : num;
    let c = absn / den; if ((absn % den) * 2n >= den) c += 1n;
    return deRacional(rac(neg ? -c : c, f));
  }
  function entero(a, modo) {
    const q = comoRacional(a);
    let c = q.num / q.den; const resto = q.num % q.den;
    if (modo === 'floor' && resto < 0n) c -= 1n;
    if (modo === 'ceil' && resto > 0n) c += 1n;
    return deEntero(c);
  }
  const FUNCIONES = {
    sqrt: (a) => raiz(a),
    cbrt: (a) => potencia(a, deRacional(rac(1, 3))),
    abs: (a) => (aFloat(a) < 0 ? negar(a) : a),
    sign: (a) => deEntero(aFloat(a) > 0 ? 1 : aFloat(a) < 0 ? -1 : 0),
    pow: (a, b) => potencia(a, b),
    hypot: (a, b) => raiz(sumar(multiplicar(a, a), multiplicar(b, b))),
    min: (...xs) => xs.reduce((m, x) => (aFloat(x) < aFloat(m) ? x : m)),
    max: (...xs) => xs.reduce((m, x) => (aFloat(x) > aFloat(m) ? x : m)),
    round: (a, n) => redondear(a, n),
    floor: (a) => entero(a, 'floor'), ceil: (a) => entero(a, 'ceil'), trunc: (a) => entero(a, 'trunc'),
    sin: (a) => trigRad('sin', a), cos: (a) => trigRad('cos', a), tan: (a) => trigRad('tan', a),
    sind: (a) => trigGrados('sin', a), cosd: (a) => trigGrados('cos', a), tand: (a) => trigGrados('tan', a),
    asin: (a) => inversaRad('asin', a), acos: (a) => inversaRad('acos', a), atan: (a) => inversaRad('atan', a),
    asind: (a) => inversaGrados('asin', a), acosd: (a) => inversaGrados('acos', a), atand: (a) => inversaGrados('atan', a),
    rad: (a) => multiplicar(dividir(a, deEntero(180)), PI),
    deg: (a) => dividir(multiplicar(a, deEntero(180)), PI),
    unsimplify: (a) => copiar(a, { modo: 'radicando' }),
    simplify: (a) => copiar(a, { modo: 'simplificado' }),
    decimal: (a) => copiar(a, { modo: 'decimal' }),
  };
  const CONSTANTES = { pi: PI, 'π': PI, g: deRacional(rac(49, 5)) };   // g = 9.8 = 49/5

  // Evalúa el árbol de FORMULAS (num/var/neg/bin/fn) con valores exactos.
  function evaluarArbol(nodo, set) {
    const vars = {};
    for (const k in (set || {})) { const q = racionalDesdeTexto(set[k]); if (q) vars[k] = deRacional(q); }
    const ev = (n) => {
      switch (n.k) {
        case 'num': {
          const q = racionalDesdeTexto(n.s != null ? n.s : String(n.v));
          if (!q) throw new NoExacto('número sin forma exacta');
          return deRacional(q);
        }
        case 'var': {
          if (Object.prototype.hasOwnProperty.call(vars, n.nombre)) return vars[n.nombre];
          if (Object.prototype.hasOwnProperty.call(CONSTANTES, n.nombre)) return CONSTANTES[n.nombre];
          if (n.nombre === 'e') throw new NoExacto('la constante e no tiene forma exacta');
          throw new Error(`Variable desconocida: ${n.nombre}`);
        }
        case 'neg': return negar(ev(n.a));
        case 'bin': {
          const a = ev(n.a), b = ev(n.b);
          switch (n.op) {
            case '+': return sumar(a, b);
            case '-': return restar(a, b);
            case '*': return multiplicar(a, b);
            case '/': return dividir(a, b);
            case '%': { const qa = comoRacional(a), qb = comoRacional(b); if (rCero(qb)) throw new Error('División por cero'); const c = entero(deRacional(rDiv(qa, qb)), 'trunc'); return restar(a, multiplicar(c, b)); }
            case '^': return potencia(a, b);
          }
          throw new Error('Operador desconocido');
        }
        case 'fn': {
          const f = FUNCIONES[n.nombre];
          if (!f) throw new NoExacto(`la función ${n.nombre} no tiene forma exacta`);
          return f.apply(null, n.args.map(ev));
        }
      }
      throw new Error('Expresión no válida');
    };
    return ev(nodo);
  }

  // ---------- formato ----------
  function fmtEntero(n) { return n.toString(); }
  // Término (a/b)√n π^k → { latex, texto } sin signo (se pasa |a|).
  function fmtTermino(q, n, k, modo) {
    const a = q.num < 0n ? -q.num : q.num, b = q.den;
    const piL = k > 0 ? (k === 1 ? '\\pi' : `\\pi^{${k}}`) : '';
    const piT = k > 0 ? (k === 1 ? 'π' : `π^${k}`) : '';
    const piDenL = k < 0 ? (k === -1 ? '\\pi' : `\\pi^{${-k}}`) : '';
    const piDenT = k < 0 ? (k === -1 ? 'π' : `π^${-k}`) : '';
    if (modo === 'radicando' && n > 1n) {
      // forma √(a²n/b²): √P, s/√Q, √P/t o √(P/Q)
      const P0 = a * a * n, Q0 = b * b, g = gcd(P0, Q0) || 1n;
      const P = P0 / g, Q = Q0 / g;
      let L, T;
      if (Q === 1n) { L = `\\sqrt{${P}}`; T = `√${P}`; }
      else {
        const s = esCuadrado(P), t = esCuadrado(Q);
        if (s !== null) { L = `\\frac{${s}}{\\sqrt{${Q}}}`; T = `${s}/√${Q}`; }
        else if (t !== null) { L = `\\frac{\\sqrt{${P}}}{${t}}`; T = `√${P}/${t}`; }
        else { L = `\\sqrt{\\frac{${P}}{${Q}}}`; T = `√(${P}/${Q})`; }
      }
      if (piL) { L += '\\,' + piL; T += piT; }
      if (piDenL) { L = `\\frac{${L}}{${piDenL}}`; T = `${T}/${piDenT}`; }
      return { latex: L, texto: T };
    }
    const radL = n > 1n ? `\\sqrt{${n}}` : '', radT = n > 1n ? `√${n}` : '';
    const cuerpoL = radL + piL, cuerpoT = radT + piT;
    const numL = cuerpoL ? (a === 1n ? cuerpoL : fmtEntero(a) + cuerpoL) : fmtEntero(a);
    const numT = cuerpoT ? (a === 1n ? cuerpoT : fmtEntero(a) + cuerpoT) : fmtEntero(a);
    if (b === 1n && !piDenL) return { latex: numL, texto: numT };
    const denL = (b === 1n ? '' : fmtEntero(b)) + piDenL, denT = (b === 1n ? '' : fmtEntero(b)) + piDenT;
    return { latex: `\\frac{${numL}}{${denL}}`, texto: `${numT}/${denT}` };
  }
  // Orden: racional primero, luego por potencia de π y radicando.
  function terminosOrdenados(a) {
    return [...a.t].map(([c, q]) => Object.assign({ q }, descl(c)))
      .sort((x, y) => (x.k - y.k) || (x.n < y.n ? -1 : x.n > y.n ? 1 : 0));
  }
  function formatear(a) {
    if (a.modo === 'decimal') return null;
    const modo = a.modo === 'radicando' ? 'radicando' : 'simplificado';
    const ts = terminosOrdenados(a);
    if (!ts.length) return { latex: '0', texto: '0' };
    let latex = '', texto = '';
    ts.forEach((t, i) => {
      const f = fmtTermino(t.q, t.n, t.k, modo);
      const neg = t.q.num < 0n;
      if (i === 0) { latex += (neg ? '-' : '') + f.latex; texto += (neg ? '-' : '') + f.texto; }
      else { latex += (neg ? ' - ' : ' + ') + f.latex; texto += (neg ? ' - ' : ' + ') + f.texto; }
    });
    return { latex, texto };
  }

  return { NoExacto, evaluarArbol, formatear, aFloat, racionalDesdeTexto, TABLA, FUNCIONES: Object.keys(FUNCIONES) };
})();
