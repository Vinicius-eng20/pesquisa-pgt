import {
  Utensils,
  Home,
  Car,
  HeartPulse,
  Gamepad2,
  GraduationCap,
  ShoppingBag,
  Tag,
  Plane,
  Gift,
  Dumbbell,
  Coffee,
  Smartphone,
  Zap,
  Droplet,
  Baby,
  Bus,
  Train,
  Bike,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  Home,
  Car,
  HeartPulse,
  Gamepad2,
  GraduationCap,
  ShoppingBag,
  Tag,
  Plane,
  Gift,
  Dumbbell,
  Coffee,
  Smartphone,
  Zap,
  Droplet,
  Baby,
  Bus,
  Train,
  Bike,
  Wallet,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

export const CATEGORY_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#0d9488',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#64748b',
];

export function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Tag;
}
