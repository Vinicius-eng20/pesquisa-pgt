import { useEffect, useState, useCallback } from 'react';
import { Loader2, Search, Ban, CheckCircle, ShieldCheck, Users as UsersIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Profile } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export function ReadersPage() {
  const { profile: me } = useAuth();
  const [readers, setReaders] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadReaders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
    setReaders((data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadReaders(); }, [loadReaders]);

  const filtered = readers.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q);
  });

  async function toggleBlock(reader: Profile) {
    setActing(reader.id);
    const { error } = await supabase.rpc('set_user_blocked', {
      p_target_id: reader.id,
      p_blocked: !reader.blocked,
    });
    if (error) setToast({ type: 'error', msg: error.message });
    else {
      setToast({
        type: 'success',
        msg: reader.blocked ? `${reader.name} foi desbloqueado.` : `${reader.name} foi bloqueado.`,
      });
      await loadReaders();
    }
    setActing(null);
    setTimeout(() => setToast(null), 4000);
  }

  async function promote(reader: Profile) {
    setActing(reader.id);
    const { error } = await supabase.rpc('promote_to_librarian', { p_target_id: reader.id });
    if (error) setToast({ type: 'error', msg: error.message });
    else {
      setToast({ type: 'success', msg: `${reader.name} agora é bibliotecário.` });
      await loadReaders();
    }
    setActing(null);
    setTimeout(() => setToast(null), 4000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Leitores</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bloqueie leitores com atraso e promova novos bibliotecários.
        </p>
      </div>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar leitor..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-gray-400">Nenhum leitor encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((reader) => (
            <div
              key={reader.id}
              className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                <span className="text-brand-700 font-medium text-sm">
                  {reader.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900 truncate">{reader.name}</h3>
                  {reader.role === 'librarian' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700">
                      <ShieldCheck className="w-3 h-3" />
                      Bibliotecário
                    </span>
                  )}
                  {reader.blocked && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                      <Ban className="w-3 h-3" />
                      Bloqueado
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Cadastrado em {formatDate(reader.created_at)}</p>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                {reader.id !== me?.id && reader.role !== 'librarian' && (
                  <>
                    <button
                      onClick={() => promote(reader)}
                      disabled={acting === reader.id}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Promover
                    </button>
                    <button
                      onClick={() => toggleBlock(reader)}
                      disabled={acting === reader.id}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
                        reader.blocked
                          ? 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200'
                      }`}
                    >
                      {acting === reader.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : reader.blocked ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        <Ban className="w-3.5 h-3.5" />
                      )}
                      {reader.blocked ? 'Desbloquear' : 'Bloquear'}
                    </button>
                  </>
                )}
                {reader.id === me?.id && (
                  <span className="text-xs text-gray-400 italic pr-2">Você</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className={`px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
