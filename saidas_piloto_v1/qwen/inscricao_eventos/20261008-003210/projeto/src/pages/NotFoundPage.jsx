import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main>
      <div className="card"><div className="empty">
        <div className="ico">🧭</div>
        <h2 style={{ margin: '8px 0' }}>Página não encontrada</h2>
        <p>O endereço que você tentou acessar não existe.</p>
        <p style={{ marginTop: 16 }}><Link className="btn btn--primary" to="/">Ir para o início</Link></p>
      </div></div>
    </main>
  );
}
