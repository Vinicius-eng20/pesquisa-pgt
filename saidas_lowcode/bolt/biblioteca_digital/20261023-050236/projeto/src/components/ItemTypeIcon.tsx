import { BookOpen, Tablet, Headphones, Newspaper, Disc, Music, Gamepad2, type LucideIcon } from 'lucide-react';
import type { ItemType } from '@/lib/types';

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Tablet,
  Headphones,
  Newspaper,
  Disc,
  Music,
  Gamepad2,
};

export function ItemTypeIcon({ type, className }: { type: ItemType; className?: string }) {
  const Icon = ICON_MAP[type] ?? BookOpen;
  return <Icon className={className} />;
}
