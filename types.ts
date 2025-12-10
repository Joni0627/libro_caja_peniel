
export enum Currency {
  CLP = 'CLP',
  USD = 'USD',
  EUR = 'EUR'
}

export enum MovementCategory {
  INCOME = 'INCOME', // Entrada (Positivo)
  EXPENSE = 'EXPENSE' // Salida (Negativo)
}

export interface Center {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;      // Nuevo
  zipCode?: string;   // Nuevo
  phone?: string;     // Nuevo
  email?: string;     // Nuevo
  responsible?: string;
}

export interface MovementType {
  id: string;
  name: string;
  category: MovementCategory;
  subCategory?: string; // Nuevo: Para agrupar en el PDF (Ej: Inversiones, Gastos Generales)
}

export interface Transaction {
  id: string;
  date: string; // ISO String YYYY-MM-DD
  centerId: string;
  movementTypeId: string;
  detail: string;
  amount: number;
  currency: string; // Changed from enum to string to support dynamic currencies
  attachment?: string; // Base64 string of the image
  excludeFromPdf?: boolean; // New: If true, ignore in PDF report
}

export interface Annotation {
  id: string;
  date: string;
  title: string;
  description: string;
  createdAt: number;
}

export interface DashboardStats {
  totalBalance: Record<string, number>;
  totalIncome: Record<string, number>;
  totalExpense: Record<string, number>;
}

export enum UserProfile {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface User {
  id: string;
  name: string;
  lastName: string;
  email: string;
  phone?: string;
  profile: UserProfile;
}
