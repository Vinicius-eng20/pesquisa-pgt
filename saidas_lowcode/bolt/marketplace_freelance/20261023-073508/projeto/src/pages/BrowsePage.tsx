import { useEffect, useState } from 'react';
import { supabase, type Service, type Profile } from '@/lib/supabase';
import { Search, Tag, Star, ArrowRight } from 'lucide-react';

const CATEGORIES = ['Tecnologia', 'Design', 'Marketing', 'Redação', 'Consultoria', 'Geral'];

interface BrowsePageProps {
  onViewService: (service: Service) => void;
}

export function BrowsePage({ onViewService }: BrowsePageProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('services')
      .select('*, provider:profiles(*)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading services:', error);
    } else if (data) {
      setServices(data as unknown as Service[]);
    }
    setLoading(false);
  };

  const filtered = services.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'Todas' || s.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Encontre o serviço ideal</h1>
        <p className="text-slate-500 mt-1">Explore serviços oferecidos por freeladores qualificados</p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar serviços..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 bg-white transition"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategory('Todas')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              category === 'Todas' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Todas
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                category === cat ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-20 mb-3" />
              <div className="h-5 bg-slate-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-full mb-1" />
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-4" />
              <div className="h-10 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhum serviço encontrado com esses critérios.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((service) => (
            <ServiceCard key={service.id} service={service} onView={() => onViewService(service)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({ service, onView }: { service: Service; onView: () => void }) {
  const provider = service.provider as unknown as Profile | undefined;

  return (
    <button
      onClick={onView}
      className="text-left bg-white rounded-xl border border-slate-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-slate-200/40 transition-all p-6 group"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">
          {service.category}
        </span>
        <span className="text-lg font-bold text-slate-900">
          R$ {Number(service.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <h3 className="font-semibold text-slate-900 text-lg mb-1.5 group-hover:text-emerald-700 transition">
        {service.title}
      </h3>
      <p className="text-slate-500 text-sm line-clamp-2 mb-4">{service.description}</p>
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-700 font-semibold text-xs">
            {provider?.display_name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <span className="text-sm text-slate-600">{provider?.display_name ?? 'Freelancer'}</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium group-hover:gap-2 transition-all">
          Ver detalhes
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
}
