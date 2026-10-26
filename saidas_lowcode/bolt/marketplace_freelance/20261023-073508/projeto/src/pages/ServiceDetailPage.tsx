import { useState, type FormEvent } from 'react';
import { supabase, type Service, type Profile, type Contract } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Tag, DollarSign, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react';

interface ServiceDetailPageProps {
  service: Service;
  onBack: () => void;
}

export function ServiceDetailPage({ service, onBack }: ServiceDetailPageProps) {
  const { profile } = useAuth();
  const [showHireForm, setShowHireForm] = useState(false);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const provider = service.provider as unknown as Profile | undefined;
  const isOwnService = profile?.id === service.provider_id;

  const handleHire = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !service.provider_id) return;
    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from('contracts').insert({
      service_id: service.id,
      client_id: profile.id,
      provider_id: service.provider_id,
      status: 'pending',
      details: details || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-full mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Solicitação enviada com sucesso!</h2>
          <p className="text-slate-500 mb-6">O prestador do serviço recebeu sua solicitação e pode aceitá-la ou recusá-la.</p>
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
          >
            Voltar ao marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">
              <Tag className="w-3 h-3 mr-1" />
              {service.category}
            </span>
            <span className="text-2xl font-bold text-slate-900">
              R$ {Number(service.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">{service.title}</h1>
          <p className="text-slate-600 leading-relaxed mb-6">{service.description}</p>

          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold text-lg">
              {provider?.display_name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="font-medium text-slate-900">{provider?.display_name ?? 'Freelancer'}</p>
              <p className="text-sm text-slate-500">{provider?.bio || 'Prestador de serviços no FreelaMarket'}</p>
            </div>
          </div>
        </div>

        {!isOwnService && (
          <div className="border-t border-slate-100 p-6 sm:p-8 bg-slate-50">
            {error && (
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {!showHireForm ? (
              <button
                onClick={() => setShowHireForm(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-700 transition shadow-lg shadow-emerald-500/20"
              >
                <DollarSign className="w-4 h-4" />
                Contratar este serviço
              </button>
            ) : (
              <form onSubmit={handleHire} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <MessageSquare className="inline w-4 h-4 mr-1 -mt-0.5" />
                    Detalhes da solicitação (opcional)
                  </label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={4}
                    placeholder="Descreva o que você precisa, prazos e expectativas..."
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition resize-none bg-white"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 transition shadow-lg shadow-emerald-500/20"
                  >
                    {submitting ? 'Enviando...' : 'Confirmar contratação'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHireForm(false)}
                    className="px-6 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium text-sm hover:bg-white transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {isOwnService && (
          <div className="border-t border-slate-100 p-6 sm:p-8 bg-amber-50">
            <p className="text-sm text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Este é o seu próprio serviço. Você não pode contratar serviços que você oferece.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
