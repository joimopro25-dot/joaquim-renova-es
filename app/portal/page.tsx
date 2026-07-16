

import React from 'react';

export default function PortalCliente() {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12">
      <div className="bg-slate-800 text-white p-8 rounded-2xl mb-8">
        <h1 className="text-2xl font-bold mb-2">Olá, Bem-vindo ao seu Portal</h1>
        <p className="text-slate-300">Acompanhe aqui o progresso da sua renovação em tempo real.</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <h2 className="text-xl font-semibold mb-6 text-slate-800">A Minha Obra</h2>
        
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
          <p className="text-slate-500">Ainda não tem obras ativas associadas a este portal.</p>
          <p className="text-sm text-slate-400 mt-2">Assim que a sua obra começar, aparecerá aqui toda a informação.</p>
        </div>
      </div>
    </div>
  );
}