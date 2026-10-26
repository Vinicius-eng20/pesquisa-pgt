export type UserRole = 'reader' | 'librarian';

export type ItemType = 'livro' | 'ebook' | 'audiobook' | 'revista' | 'dvd' | 'cd' | 'jogo';

export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  blocked: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  title: string;
  author: string;
  type: ItemType;
  description: string;
  cover_url: string | null;
  total_copies: number;
  available_copies: number;
  created_at: string;
}

export interface Loan {
  id: string;
  user_id: string;
  item_id: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  created_at: string;
  item?: Item;
  profile?: Profile;
}

export interface LoanWithItem extends Loan {
  item: Item;
}

export interface LoanWithDetails extends Loan {
  item: Item;
  profile: Profile;
}

export const ITEM_TYPES: { value: ItemType; label: string; icon: string }[] = [
  { value: 'livro', label: 'Livro', icon: 'BookOpen' },
  { value: 'ebook', label: 'E-book', icon: 'Tablet' },
  { value: 'audiobook', label: 'Audiobook', icon: 'Headphones' },
  { value: 'revista', label: 'Revista', icon: 'Newspaper' },
  { value: 'dvd', label: 'DVD', icon: 'Disc' },
  { value: 'cd', label: 'CD', icon: 'Music' },
  { value: 'jogo', label: 'Jogo', icon: 'Gamepad2' },
];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  livro: 'Livro',
  ebook: 'E-book',
  audiobook: 'Audiobook',
  revista: 'Revista',
  dvd: 'DVD',
  cd: 'CD',
  jogo: 'Jogo',
};
