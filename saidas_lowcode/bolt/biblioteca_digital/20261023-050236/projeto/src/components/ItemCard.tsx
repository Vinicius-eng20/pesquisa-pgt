import { Book } from 'lucide-react';
import type { Item } from '@/lib/types';
import { ITEM_TYPE_LABELS } from '@/lib/types';
import { ItemTypeIcon } from './ItemTypeIcon';

interface ItemCardProps {
  item: Item;
  onBorrow?: (item: Item) => void;
  onEdit?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onReturn?: (item: Item) => void;
  isBorrowed?: boolean;
  canBorrow?: boolean;
  showLibrarianActions?: boolean;
}

export function ItemCard({
  item,
  onBorrow,
  onEdit,
  onDelete,
  onReturn,
  isBorrowed = false,
  canBorrow = false,
  showLibrarianActions = false,
}: ItemCardProps) {
  const available = item.available_copies > 0;

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-brand-200 transition-all duration-300 flex flex-col">
      <div className="relative aspect-[3/4] bg-brand-50 overflow-hidden">
        {item.cover_url ? (
          <img
            src={item.cover_url}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Book className="w-16 h-16 text-brand-300" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/95 backdrop-blur px-2.5 py-1 rounded-full text-xs font-medium text-gray-700 shadow-sm">
          <ItemTypeIcon type={item.type} className="w-3.5 h-3.5 text-brand-600" />
          {ITEM_TYPE_LABELS[item.type]}
        </div>
        {available && !isBorrowed && (
          <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
            Disponível
          </div>
        )}
        {!available && !isBorrowed && (
          <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
            Esgotado
          </div>
        )}
        {isBorrowed && (
          <div className="absolute top-3 right-3 bg-ocean-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
            Com você
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-serif text-base font-semibold text-gray-900 leading-snug line-clamp-2">
          {item.title}
        </h3>
        {item.author && (
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{item.author}</p>
        )}
        {item.description && (
          <p className="text-xs text-gray-400 mt-2 line-clamp-2">{item.description}</p>
        )}

        <div className="mt-3 text-xs text-gray-400">
          {item.available_copies} de {item.total_copies} disponíveis
        </div>

        <div className="mt-4 flex gap-2 mt-auto pt-2">
          {canBorrow && available && !isBorrowed && (
            <button
              onClick={() => onBorrow?.(item)}
              className="flex-1 bg-brand-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-brand-700 transition-colors"
            >
              Pegar emprestado
            </button>
          )}
          {canBorrow && !available && !isBorrowed && (
            <button
              disabled
              className="flex-1 bg-gray-100 text-gray-400 text-sm font-medium py-2 rounded-lg cursor-not-allowed"
            >
              Indisponível
            </button>
          )}
          {isBorrowed && (
            <button
              onClick={() => onReturn?.(item)}
              className="flex-1 bg-ocean-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-ocean-700 transition-colors"
            >
              Devolver
            </button>
          )}

          {showLibrarianActions && (
            <>
              <button
                onClick={() => onEdit?.(item)}
                className="flex-1 bg-gray-50 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
              >
                Editar
              </button>
              <button
                onClick={() => onDelete?.(item)}
                className="px-3 bg-red-50 text-red-600 text-sm font-medium py-2 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
              >
                Remover
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
