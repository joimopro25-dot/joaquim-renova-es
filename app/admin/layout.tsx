import React from 'react';
import Link from 'next/link';
import { Users, Briefcase, LayoutDashboard, Package, Receipt } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 text-xl font-bold border-b border-slate-800">
          Joaquim CRM
        </div>
        <nav className="flex-1 p-4 space-y-2 font-medium">
          <Link href="/admin" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition">
            <LayoutDashboard size={20} /> Dashboard
          </Link>
          <Link href="/admin/clientes" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition">
            <Users size={20} /> Clientes
          </Link>
          <Link href="/admin/obras" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition">
            <Briefcase size={20} /> Obras
          </Link>
          <Link href="/admin/despesas" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition">
            <Receipt size={20} /> Despesas/Faturas
          </Link>
          <Link href="/admin/stock" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition">
            <Package size={20} /> Stock/Ferramentas
          </Link>
        </nav>
      </aside>

      {/* Content Area */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}