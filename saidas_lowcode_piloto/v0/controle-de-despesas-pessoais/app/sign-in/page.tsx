'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    const result = await authClient.signIn.email({ email, password })
    if (result.error) setError('Não foi possível entrar. Confira seus dados e tente novamente.')
    else { router.push('/'); router.refresh() }
    setBusy(false)
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4"><form onSubmit={submit} className="flex w-full max-w-md flex-col gap-5 rounded-3xl bg-white p-8"><div><p className="text-sm font-semibold text-indigo-600">Saldo.</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Entrar na sua conta</h1><p className="mt-1 text-sm text-slate-500">Acesse seus gastos de qualquer dispositivo.</p></div><label className="text-sm font-medium text-slate-700">E-mail<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3" /></label><label className="text-sm font-medium text-slate-700">Senha<input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3" /></label>{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}<button disabled={busy} className="rounded-xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-60">{busy ? 'Entrando...' : 'Entrar'}</button><p className="text-center text-xs text-slate-500">Sua conta e seus dados ficam protegidos e sincronizados.</p></form></main>
}
