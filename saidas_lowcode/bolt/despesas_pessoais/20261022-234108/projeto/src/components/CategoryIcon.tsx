import {
  Utensils, Car, Home, HeartPulse, Gamepad2, GraduationCap, ShoppingBag,
  Banknote, Tag, Plane, Dumbbell, Gift, Coffee, Smartphone, BookOpen,
  Wrench, PawPrint, Baby, CreditCard, Building2, Briefcase, Zap,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Utensils, Car, Home, HeartPulse, Gamepad2, GraduationCap, ShoppingBag,
  Banknote, Tag, Plane, Dumbbell, Gift, Coffee, Smartphone, BookOpen,
  Wrench, PawPrint, Baby, CreditCard, Building2, Briefcase, Zap,
};

export const availableIcons = Object.keys(iconMap).sort();

export function CategoryIcon({ name, size = 20, className = '', color }: { name: string; size?: number; className?: string; color?: string }) {
  const Icon = iconMap[name] || Tag;
  return <Icon size={size} className={className} style={color ? { color } : undefined} />;
}
