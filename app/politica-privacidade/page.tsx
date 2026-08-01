import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Política de Privacidade — Projetar Conforto',
};

export default function PoliticaPrivacidade() {
  return (
    <main className="min-h-screen bg-sand-50">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-6">
          <ArrowLeft size={16} /> Voltar ao site
        </Link>

        <div className="card p-8">
          <h1 className="text-2xl font-heading font-semibold text-ink-800 mb-1">Política de Privacidade</h1>
          <p className="text-sm text-ink-400 mb-8">Última atualização: 1 de agosto de 2026</p>

          <div className="prose-legal space-y-6 text-sm text-ink-700 leading-relaxed">
            <section>
              <h2 className="font-semibold text-ink-800 mb-2">1. Responsável pelo Tratamento</h2>
              <p>
                <strong>[Nome legal / firma completa a preencher]</strong>, NIPC/NIF <strong>[a preencher]</strong>,
                com sede/domicílio profissional em <strong>[morada a preencher]</strong>, é a responsável pelo
                tratamento dos dados pessoais recolhidos através de projetarconforto.pt e do Portal do Cliente.
                Contacto para assuntos de privacidade: <strong>[email de contacto a preencher]</strong>.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">2. Que Dados Recolhemos</h2>
              <p>Consoante a forma como interage connosco, podemos recolher:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Dados de identificação e contacto: nome, email, telefone, morada, NIF.</li>
                <li>Dados de pedidos e obras: descrição do pedido, fotos do imóvel/obra, progresso, orçamentos, faturas, comprovativos de pagamento.</li>
                <li>Dados de acesso ao Portal do Cliente: email e palavra-passe (a palavra-passe é armazenada de forma encriptada, sem acesso por nós em texto simples).</li>
                <li>Comunicações trocadas connosco, incluindo correio eletrónico.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">3. Finalidades e Fundamento Legal</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Execução de contrato</strong> — gerir pedidos de orçamento, elaborar e executar contratos de prestação de serviços, faturação e cobrança.</li>
                <li><strong>Obrigação legal</strong> — cumprimento de obrigações fiscais e contabilísticas.</li>
                <li><strong>Consentimento</strong> — envio de comunicações não estritamente necessárias à execução do contrato, quando aplicável.</li>
                <li><strong>Interesse legítimo</strong> — melhoria dos nossos serviços, segurança da plataforma e prevenção de fraude.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">4. Com Quem Partilhamos os Dados</h2>
              <p>
                Recorremos a prestadores de serviços terceiros que atuam como subcontratantes (processadores) dos
                dados, nomeadamente para alojamento de base de dados e autenticação, alojamento do site, envio de
                emails, e encaminhamento/DNS. Estes prestadores tratam os dados apenas segundo as nossas instruções e
                com garantias contratuais de proteção de dados. Não vendemos nem cedemos os seus dados a terceiros
                para fins de marketing.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">5. Prazo de Conservação</h2>
              <p>
                Conservamos os dados enquanto durar a relação contratual e, após o seu términus, pelos prazos legais
                de conservação aplicáveis (nomeadamente prazos de conservação de documentos fiscais e contabilísticos
                previstos na legislação portuguesa). Findos esses prazos, os dados são eliminados ou anonimizados.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">6. Os Seus Direitos</h2>
              <p>
                Nos termos do RGPD, tem direito a aceder, retificar, apagar ou limitar o tratamento dos seus dados,
                a opor-se ao tratamento, e à portabilidade dos dados, nos casos e termos previstos na lei. Pode
                exercer estes direitos contactando-nos através de <strong>[email de contacto a preencher]</strong>.
                Tem ainda o direito de apresentar reclamação junto da Comissão Nacional de Proteção de Dados (CNPD) —{' '}
                <a href="https://www.cnpd.pt" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">www.cnpd.pt</a>.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">7. Segurança</h2>
              <p>
                Adotamos medidas técnicas e organizativas adequadas para proteger os seus dados, incluindo acesso
                restrito por autenticação, encriptação de palavras-passe, e controlo de acesso por perfil (cliente vs.
                administração), de forma a impedir que um cliente aceda a dados de outro.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">8. Cookies</h2>
              <p>
                Este site utiliza apenas cookies técnicos essenciais ao funcionamento da autenticação e da sessão no
                Portal do Cliente e no Backoffice. Não utilizamos cookies de publicidade nem de rastreio de terceiros.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">9. Alterações</h2>
              <p>
                Esta Política pode ser atualizada periodicamente. A versão em vigor é sempre a publicada nesta página,
                com indicação da data da última atualização.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
