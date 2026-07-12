/**
 * Catálogo de simulaciones.
 * Los campos `level` se conservan solo para datos internos / progreso;
 * la UI muestra un único listado unificado (sin etiquetas de grado).
 */

export const LEVELS = [
  { id: 'middle', label: 'Secundaria', labelEn: 'Middle School' },
  { id: 'high', label: 'Bachillerato', labelEn: 'High School' },
  { id: 'advanced', label: 'Avanzado', labelEn: 'Advanced' }
];

/**
 * Módulo especial del menú: importar / exportar / ver trabajos en caché.
 * No abre un motor de simulación.
 */
export const WORKS_MODULE = {
  id: 'my-works',
  title: 'Mis trabajos',
  titleEn: 'My works',
  level: 'all',
  blurb:
    'Importar o exportar JSON, y ver trabajos guardados o importados en este navegador.',
  engineKey: null,
  status: 'ready',
  special: 'works',
  hub: true
};

/** @type {Array<Record<string, unknown>>} */
export const CATALOG = [
  // Docente (una sola entrada de pizarra en el menú unificado)
  {
    id: 'whiteboard',
    title: 'Pizarra',
    titleEn: 'Whiteboard',
    level: 'middle',
    blurb: 'Pizarra en blanco para ejemplos del profesor.',
    engineKey: 'whiteboard',
    status: 'ready',
    teacher: true
  },

  // —— Middle School ——
  {
    id: 'magnetic-fields',
    title: 'Campos magnéticos',
    titleEn: 'Magnetic Fields',
    level: 'middle',
    blurb: 'Carga en B uniforme: órbita circular y F = qvB.',
    engineKey: 'magnetic',
    status: 'ready'
  },
  {
    id: 'forces-motion',
    title: 'Fuerzas y movimiento',
    titleEn: 'Forces & Motion',
    level: 'middle',
    blurb: 'Fuerza neta, masa y aceleración (F = ma). Espacio infinito disponible.',
    engineKey: 'dynamics',
    status: 'ready'
  },
  {
    id: 'circuits',
    title: 'Circuitos',
    titleEn: 'Circuits',
    level: 'middle',
    blurb: 'Ley de Ohm, serie/paralelo y Kirchhoff.',
    engineKey: 'electricity',
    status: 'ready'
  },
  {
    id: 'potential-kinetic',
    title: 'Energía potencial y cinética',
    titleEn: 'Potential & Kinetic Energy',
    level: 'middle',
    blurb: 'Energía y fuerzas: exploración con dinámica.',
    engineKey: 'dynamics',
    status: 'ready'
  },
  {
    id: 'waves-energy-transfer',
    title: 'Ondas y transferencia de energía',
    titleEn: 'Waves & Energy Transfer',
    level: 'middle',
    blurb: 'Frentes de onda y propagación (vista con módulo de sonido).',
    engineKey: 'sound',
    status: 'ready'
  },
  {
    id: 'conservation-energy',
    title: 'Conservación de la energía',
    titleEn: 'Conservation of Energy',
    level: 'middle',
    blurb: 'Em en el oscilador y sistemas dinámicos.',
    engineKey: 'oscillatory',
    status: 'ready'
  },

  // —— High School (level solo metadato; menú unificado) ——
  {
    id: 'light',
    title: 'Luz',
    titleEn: 'Light',
    level: 'high',
    blurb: 'Óptica geométrica: espejos y lentes.',
    engineKey: 'optics',
    status: 'ready'
  },
  {
    id: 'one-d-motion',
    title: 'Movimiento unidimensional',
    titleEn: 'One-dimensional Motion',
    level: 'high',
    blurb: 'MRU/MRUV con espacio infinito y cámara.',
    engineKey: 'kinematics',
    status: 'ready'
  },
  {
    id: 'momentum',
    title: 'Momentum',
    titleEn: 'Momentum',
    level: 'high',
    blurb: 'Colisiones 1D elásticas e inelásticas.',
    engineKey: 'momentum',
    status: 'ready'
  },
  {
    id: 'sound',
    title: 'Sonido',
    titleEn: 'Sound',
    level: 'high',
    blurb: 'Velocidad del sonido y efecto Doppler.',
    engineKey: 'sound',
    status: 'ready'
  },
  {
    id: 'electrodynamics',
    title: 'Electrodinámica',
    titleEn: 'Electrodynamics',
    level: 'high',
    blurb: 'Circuitos y cargas en movimiento (base).',
    engineKey: 'electricity',
    status: 'ready'
  },
  {
    id: 'universal-gravity',
    title: 'Gravedad universal',
    titleEn: 'Universal Gravity',
    level: 'high',
    blurb: 'Órbitas 2D con masa central fija.',
    engineKey: 'gravity',
    status: 'ready'
  },

  // —— Advanced (level solo metadato; menú unificado) ——
  {
    id: 'two-d-motion',
    title: 'Movimiento bidimensional',
    titleEn: 'Two-dimensional Motion',
    level: 'advanced',
    blurb: 'Movimiento en el plano con vectores (cinemática).',
    engineKey: 'kinematics',
    status: 'ready'
  },
  {
    id: 'oscillatory-motion',
    title: 'Movimiento oscilatorio',
    titleEn: 'Oscillatory Motion',
    level: 'advanced',
    blurb: 'MHS: resorte, periodo y energía.',
    engineKey: 'oscillatory',
    status: 'ready'
  },
  {
    id: 'atomic-physics',
    title: 'Física atómica',
    titleEn: 'Atomic Physics',
    level: 'advanced',
    blurb: 'Modelo de Bohr: niveles, órbitas y fotones en saltos de energía.',
    engineKey: 'atomic',
    status: 'ready'
  },
  {
    id: 'particle-physics',
    title: 'Física de partículas',
    titleEn: 'Particle Physics',
    level: 'advanced',
    blurb: 'Cargas en campo B: curvatura, r = mv/|q|B y especies (e⁻, p⁺, α…).',
    engineKey: 'particles',
    status: 'ready'
  },
  {
    id: 'wave-optics',
    title: 'Óptica ondulatoria',
    titleEn: 'Wave Optics',
    level: 'advanced',
    blurb: 'Base óptica; interferencia dedicada próximamente.',
    engineKey: 'optics',
    status: 'ready'
  },
  {
    id: 'rotational-motion',
    title: 'Movimiento rotacional',
    titleEn: 'Rotational Motion',
    level: 'advanced',
    blurb: 'Órbita y movimiento circular (usa gravedad / B).',
    engineKey: 'magnetic',
    status: 'ready'
  }
];

export function getByLevel(levelId) {
  return CATALOG.filter((m) => m.level === levelId);
}

export function getById(id) {
  if (id === WORKS_MODULE.id) return { ...WORKS_MODULE };
  return CATALOG.find((m) => m.id === id) || null;
}

/**
 * Listado único para el menú principal y la barra lateral:
 * sin pestañas por grado y sin pizarras duplicadas.
 * “Mis trabajos” va primero.
 */
export function getUnifiedCatalog() {
  const list = [{ ...WORKS_MODULE }];
  const seenEngineTeacher = new Set();

  for (const m of CATALOG) {
    if (m.teacher && m.engineKey === 'whiteboard') {
      if (seenEngineTeacher.has('whiteboard')) continue;
      seenEngineTeacher.add('whiteboard');
    }
    list.push(m);
  }
  return list;
}

/** Módulos de simulación (sin el hub de trabajos). */
export function getSimulationCatalog() {
  return getUnifiedCatalog().filter((m) => m.special !== 'works');
}
