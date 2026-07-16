import React from 'react';

export default function AdminDashboard() {
  return (
    <div className="p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Painel de Gestão (CRM)</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
          + Nova Obra
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-slate-500 text-sm font-medium">Obras em Curso</h3>
          <p className="text-3xl font-bold text-slate-800">0</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-slate-500 text-sm font-medium">Orçamentos Pendentes</h3>
          <p className="text-3xl font-bold text-slate-800">0</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-slate-500 text-sm font-medium">Faturas por Validar</h3>
          <p className="text-3xl font-bold text-slate-800">0</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="font-semibold text-slate-700">Obras Recentes</h2>
        </div>
        <div className="p-8 text-center text-slate-500 text-sm italic">
          Nenhuma obra registada. Clique em "Nova Obra" para começar.
        </div>
      </div>
    </div>
  );
}