import { Center, MovementType, MovementCategory, Currency, User, UserProfile } from './types';

export const INITIAL_CENTERS: Center[] = [
  { 
    id: 'c1', 
    name: 'Sede Central', 
    code: 'HQ', 
    address: 'Av. Principal 123', 
    city: 'Córdoba', 
    zipCode: '5000', 
    phone: '+54 9 351 123 4567', 
    responsible: 'Pastor Juan',
    email: 'central@peniel.com'
  },
  { 
    id: 'c2', 
    name: 'Anexo Norte', 
    code: 'NRT', 
    address: 'Zona Norte 456', 
    city: 'Córdoba', 
    zipCode: '5001', 
    responsible: 'Hno. Pedro' 
  },
];

export const INITIAL_MOVEMENT_TYPES: MovementType[] = [
  // --- INGRESOS ---
  { id: 'ing_ofrendas', name: 'OFRENDAS', category: MovementCategory.INCOME, subCategory: 'ENTRADAS' },
  { id: 'ing_escuela_dominical', name: 'ESCUELA DOMINICAL', category: MovementCategory.INCOME, subCategory: 'ENTRADAS' },
  { id: 'ing_ofrendas_misioneras', name: 'OFRENDAS MISIONERAS', category: MovementCategory.INCOME, subCategory: 'ENTRADAS' },
  { id: 'ing_donaciones', name: 'DONACIONES (RESOLUCIÓN AFIP-DGI)', category: MovementCategory.INCOME, subCategory: 'ENTRADAS' },
  { id: 'ing_contribuciones', name: 'CONTRIBUCIONES', category: MovementCategory.INCOME, subCategory: 'ENTRADAS' },
  { id: 'ing_otras_entradas', name: 'OTRAS ENTRADAS', category: MovementCategory.INCOME, subCategory: 'ENTRADAS' },
  { id: 'ing_subsidios', name: 'SUBSIDIOS O CONVENIOS ESTATALES', category: MovementCategory.INCOME, subCategory: 'ENTRADAS' },
  // Nuevo Tipo para Recupero de Inversión
  { id: 'ing_recupero_inversion', name: 'RECUPERO INVERSIONES PENIEL', category: MovementCategory.INCOME, subCategory: 'ENTRADAS' },
  
  // --- EGRESOS: INVERSIONES ---
  { id: 'egr_construcciones', name: 'CONSTRUCCIONES', category: MovementCategory.EXPENSE, subCategory: 'INVERSIONES' },
  { id: 'egr_instalaciones', name: 'INSTALACIONES', category: MovementCategory.EXPENSE, subCategory: 'INVERSIONES' },
  { id: 'egr_instrum_musicales', name: 'INSTRUM. MUSICALES', category: MovementCategory.EXPENSE, subCategory: 'INVERSIONES' },
  { id: 'egr_maquinas', name: 'MÁQUINAS Y HERRAMIENTAS', category: MovementCategory.EXPENSE, subCategory: 'INVERSIONES' },
  { id: 'egr_muebles', name: 'MUEBLES Y ÚTILES', category: MovementCategory.EXPENSE, subCategory: 'INVERSIONES' },
  { id: 'egr_terrenos', name: 'TERRENOS O INMUEBLES', category: MovementCategory.EXPENSE, subCategory: 'INVERSIONES' },
  
  // --- EGRESOS: GASTOS ESPECÍFICOS DE MINISTERIO ---
  { id: 'egr_accion_social', name: 'ACCIÓN SOCIAL', category: MovementCategory.EXPENSE, subCategory: 'GASTOS ESPECIFICOS DE MINISTERIO' },
  { id: 'egr_evangelismo', name: 'EVANGELISMO', category: MovementCategory.EXPENSE, subCategory: 'GASTOS ESPECIFICOS DE MINISTERIO' },
  { id: 'egr_escuela_dominical_sal', name: 'ESCUELA DOMINICAL (EGRESO)', category: MovementCategory.EXPENSE, subCategory: 'GASTOS ESPECIFICOS DE MINISTERIO' },
  { id: 'egr_gastos_cultos', name: 'GASTOS DE CULTOS', category: MovementCategory.EXPENSE, subCategory: 'GASTOS ESPECIFICOS DE MINISTERIO' },
  { id: 'egr_ofrendas_misioneras_sal', name: 'OFRENDAS MISIONERAS (SALIDA)', category: MovementCategory.EXPENSE, subCategory: 'GASTOS ESPECIFICOS DE MINISTERIO' },
  { id: 'egr_ofrendas_campamento', name: 'OFRENDAS CAMPAMENTO "HEBRÓN"', category: MovementCategory.EXPENSE, subCategory: 'GASTOS ESPECIFICOS DE MINISTERIO' },
  { id: 'egr_radio_tv', name: 'RADIO Y TV', category: MovementCategory.EXPENSE, subCategory: 'GASTOS ESPECIFICOS DE MINISTERIO' },
  { id: 'egr_gastos_subsidios', name: 'GASTOS ESPECÍFICOS DE SUBSIDIOS', category: MovementCategory.EXPENSE, subCategory: 'GASTOS ESPECIFICOS DE MINISTERIO' },

  // --- EGRESOS: GASTOS GENERALES ---
  { id: 'egr_alquileres', name: 'ALQUILERES', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
  { id: 'egr_conservaciones', name: 'CONSERVACIONES Y REPARACIONES', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
  { id: 'egr_franqueo', name: 'FRANQUEO Y TELÉFONO', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
  { id: 'egr_gas', name: 'GAS Y COMBUSTIBLE', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
  { id: 'egr_impuestos', name: 'IMPUESTOS Y CONTRIBUCIONES', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
  { id: 'egr_suministro_electrico', name: 'SUMINISTRO ELÉCTRICO', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
  { id: 'egr_otros_servicios', name: 'OTROS SERVICIOS', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
  { id: 'egr_viaticos', name: 'VIÁTICOS', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
  { id: 'egr_fletes', name: 'FLETES Y ACARREOS', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
  { id: 'egr_otros_gastos', name: 'OTROS GASTOS', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
  { id: 'egr_limpieza', name: 'LIMPIEZA Y MANTENIMIENTO', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
  { id: 'egr_gastos_oficina', name: 'GASTOS DE OFICINA', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
  { id: 'egr_gastos_negro', name: 'GASTOS EN NEGRO', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
  { id: 'egr_inversiones', name: 'INVERSIONES PENIEL', category: MovementCategory.EXPENSE, subCategory: 'GASTOS GENERALES' },
];

export const INITIAL_CURRENCIES = ['ARS', 'USD'];

export const INITIAL_USERS: User[] = [
  {
    id: 'admin1',
    name: 'Administrador',
    lastName: 'Principal',
    email: 'admin@peniel.com',
    profile: UserProfile.ADMIN,
    phone: '+54 351 000000'
  }
];