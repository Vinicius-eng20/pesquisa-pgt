'use client'

import { useState } from 'react'
import { ArrowUpRight, BarChart3, ChevronDown, CircleHelp, CreditCard, LayoutDashboard, LogOut, Menu, Plus, Settings, Tag, TrendingDown, Wallet, X } from 'lucide-react'

const expenses = [
  { name: 'Supermercado', category: 'Alimentação', date: 'Hoje, 10:32', amount: 'R$ 186,40', color: 'bg-amber-100 text-amber-700' },
  { name: 'Aluguel', category: 'Moradia', date: '12 jun, 09:15', amount: 'R$ 1.850,00', color: 'bg-sky-100 text-sky-700' },
  { name: 'Uber', category: 'Transporte', date: '11 jun, 18:45', amount: 'R$ 24,90', color: 'bg-violet-100 text-violet-700' },
  { name: 'Academia', category: 'Saúde', date: '10 jun, 08:00', amount: 'R$ 119,90', color: 'bg-rose-100 text-rose-700' },
]

const categories = [
  { name: 'Moradia', amount: 'R$ 2.360,00', percent: 42, color: 'bg-sky-500' },
  { name: 'Alimentação', amount: 'R$ 980,30', percent: 26, color: 'bg-amber-400' },
  { name: 'Transporte', amount: 'R$ 420,50', percent: 14, color: 'bg-violet-500' },
  { name: 'Saúde', amount: 'R$ 290,00', percent: 9, color: 'bg-rose-400' },
]

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showExpense, setShowExpense] = useState(false)

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <aside className={`fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-slate-200 bg-white px-5 py-6 transition-transform lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5"><div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-white">$</div><span className="text-lg font-bold tracking-tight">Meu Bolso</span></div>
          <button className="text-slate-400 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X /></button>
        </div>
        <nav className="mt-12 flex flex-col gap-2" aria-label="Menu principal">
          <a className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700" href="#inicio"><LayoutDashboard /> Visão geral</a>
          <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50" href="#despesas"><CreditCard /> Minhas despesas</a>
          <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50" href="#categorias"><Tag /> Categorias</a>
          <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50" href="#relatorios"><BarChart3 /> Relatórios</a>
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-5">
          <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500" href="#ajuda"><CircleHelp /> Central de ajuda</a>
          <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500" href="#configuracoes"><Settings /> Configurações</a>
          <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-5"><div className="flex size-9 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">MS</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Marina Silva</p><p className="truncate text-xs text-slate-400">marina@email.com</p></div><LogOut className="text-slate-400" /></div>
        </div>
      </aside>

      <section className="lg:pl-64">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-8"><button className="text-slate-500 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu /></button><div className="hidden lg:block" /><div className="flex items-center gap-3"><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">Junho 2024 <ChevronDown className="ml-1 inline size-4" /></button><div className="hidden size-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 sm:flex">MS</div></div></header>
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-emerald-600">Boa tarde, Marina</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Visão geral</h1><p className="mt-2 text-sm text-slate-500">Acompanhe seus gastos e mantenha sua vida financeira organizada.</p></div><button onClick={() => setShowExpense(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-600"><Plus /> Adicionar despesa</button></div>
          <div className="mt-8 grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-emerald-500 p-6 text-white shadow-sm shadow-emerald-100"><div className="flex items-center justify-between"><p className="text-sm text-emerald-50">Total gasto em junho</p><Wallet className="size-5 text-emerald-100" /></div><p className="mt-5 text-3xl font-bold">R$ 4.050,80</p><div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-50"><TrendingDown className="size-4" /> 8,4% menos que maio</div></div><div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">Média diária</p><p className="mt-5 text-3xl font-bold text-slate-950">R$ 225,04</p><p className="mt-4 text-xs text-slate-400">Baseado nos últimos 18 dias</p></div><div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">Maior categoria</p><p className="mt-5 text-3xl font-bold text-slate-950">Moradia</p><p className="mt-4 text-xs text-slate-400">42% dos seus gastos</p></div></div>
          <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
            <div id="despesas" className="rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h2 className="font-bold">Despesas recentes</h2><p className="mt-1 text-sm text-slate-500">Seus últimos lançamentos</p></div><button className="text-sm font-semibold text-emerald-600">Ver todas <ArrowUpRight className="ml-1 inline size-4" /></button></div><div className="divide-y divide-slate-100">{expenses.map((expense) => <div className="flex items-center gap-3 px-6 py-4" key={expense.name}><div className={`flex size-10 items-center justify-center rounded-xl text-xs font-bold ${expense.color}`}>{expense.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{expense.name}</p><p className="mt-1 text-xs text-slate-400">{expense.category} · {expense.date}</p></div><p className="text-sm font-bold text-slate-700">{expense.amount}</p></div>)}</div></div>
            <div id="categorias" className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="font-bold">Por categoria</h2><p className="mt-1 text-sm text-slate-500">Como você está gastando</p></div><BarChart3 className="size-5 text-slate-400" /></div><div className="mt-7 flex flex-col gap-5">{categories.map((category) => <div key={category.name}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-slate-600">{category.name}</span><span className="font-semibold text-slate-800">{category.amount}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${category.color}`} style={{ width: `${category.percent}%` }} /></div></div>)}</div><button className="mt-7 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Ver relatório completo</button></div>
          </div>
        </div>
      </section>

      {showExpense && <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/30 p-4 sm:items-center"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Adicionar despesa</h2><button onClick={() => setShowExpense(false)} aria-label="Fechar"><X className="text-slate-400" /></button></div><div className="mt-6 flex flex-col gap-4"><label className="text-sm font-medium">Descrição<input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Ex.: Mercado" /></label><label className="text-sm font-medium">Valor<input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="R$ 0,00" /></label><label className="text-sm font-medium">Categoria<select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500"><option>Alimentação</option><option>Moradia</option><option>Transporte</option><option>Saúde</option></select></label><button onClick={() => setShowExpense(false)} className="mt-2 rounded-xl bg-emerald-500 py-3 font-semibold text-white hover:bg-emerald-600">Salvar despesa</button></div></div></div>}
    </main>
  )
}
