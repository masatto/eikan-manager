export interface Player {
  id: string;
  name: string;
  grade: number;
  main: string;
  subs: string[];
  subsHigh: string[];
  abilities: Record<string, string | number>;
  pitch: Record<string, string | number>;
  specialAbilities: string[];
  memo: string;
  updatedAt?: number;
}

export interface AuthUser {
  authenticated: boolean;
  userId?: string;
  name?: string;
  email?: string;
  picture?: string;
}

export interface SpecialAbility {
  name: string;
  type: string;
  target: string;
  category: string;
  weight: number;
  manualWeight: number;
  autoWeight: number;
}

export interface AppConfig {
  rankValues: Record<string, number>;
  positionBonus: Record<string, number>;
  topCounts: Record<string, number>;
  startingCounts: Record<string, number>;
  positionThresholds: Record<string, { excellent: number; good: number; warning: number }>;
  positionWeights: Record<string, Record<string, number>>;
  overallWeights: Record<string, number>;
  pitcherWeights: Record<string, Record<string, number>>;
  pitcherThresholds: Record<string, number>;
  speedScale: { min: number; max: number };
  pitchTypeScale: { min: number; max: number };
  totalBreakScale: { min: number; max: number };
  positionRoles: Record<string, { defense: number; batting: number }>;
  manualBaseWeights: Record<string, Record<string, number>>;
  specialAbilities: SpecialAbility[];
}

export interface LineupResult {
  assigned: Map<number, Player>;
  dh: Player | null;
  bench: Player[];
}
