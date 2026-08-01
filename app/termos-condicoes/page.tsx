import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Termos e Condições — Projetar Conforto',
};

export default function TermosCondicoes() {
  return (
    <main className="min-h-screen bg-sand-50">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-6">
          <ArrowLeft size={16} /> Voltar ao site
        </Link>

        <div className="card p-8">
          <h1 className="text-2xl font-heading font-semibold text-ink-800 mb-1">Termos e Condições</h1>
          <p className="text-sm text-ink-400 mb-8">Última atualização: 1 de agosto de 2026</p>

          <div className="prose-legal space-y-6 text-sm text-ink-700 leading-relaxed">
            <section>
              <h2 className="font-semibold text-ink-800 mb-2">1. Identificação</h2>
              <p>
                O presente site e plataforma (projetarconforto.pt, incluindo o Portal do Cliente e o Backoffice) são
                explorados por <strong>[Nome legal / firma completa a preencher]</strong>, com o NIPC/NIF{' '}
                <strong>[a preencher]</strong>, com sede/domicílio profissional em <strong>[morada a preencher]</strong>,
                doravante designada por "Projetar Conforto", "nós" ou "a Empresa". Contacto:{' '}
                <strong>[email de contacto a preencher]</strong>.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">2. Objeto</h2>
              <p>
                A Projetar Conforto presta serviços de reabilitação, renovação e obras em imóveis. Este site permite
                solicitar orçamentos; o Portal do Cliente permite acompanhar o progresso de obras, consultar e aprovar
                orçamentos, e comunicar com a Empresa. A utilização do site e do Portal implica a aceitação destes
                Termos e Condições e da nossa <Link href="/politica-privacidade" className="text-brand-600 hover:underline">Política de Privacidade</Link>.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">3. Pedidos de Orçamento e Orçamentos</h2>
              <p>
                O envio de um pedido através do formulário do site não constitui um contrato nem uma obrigação de
                aceitação por qualquer das partes. Os orçamentos emitidos pela Empresa são válidos pelo prazo neles
                indicado (por defeito, 30 dias a contar da data de emissão), findo o qual poderão ser revistos. A
                aprovação de um orçamento, seja por escrito, por email ou através do Portal do Cliente, constitui
                aceitação das condições nele descritas, incluindo valores, prazos estimados e condições de pagamento.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">4. Execução dos Trabalhos</h2>
              <p>
                Os prazos indicados em orçamento são estimativas de boa-fé, sujeitas a fatores fora do controlo da
                Empresa, nomeadamente condições meteorológicas, disponibilidade de materiais junto de fornecedores
                terceiros, e imprevistos técnicos identificados durante a execução (ex.: estado do suporte não visível
                à data do orçamento). Alterações ao âmbito dos trabalhos pedidas pelo cliente, ou necessárias por
                imprevistos técnicos relevantes, poderão implicar um orçamento adicional, a apresentar e aprovar antes
                da sua execução.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">5. Pagamentos</h2>
              <p>
                As condições de pagamento (incluindo eventuais adiantamentos, faseamento e prazos) são as descritas em
                cada orçamento/contrato específico. O incumprimento reiterado dos prazos de pagamento acordados pode
                justificar a suspensão dos trabalhos até regularização, sem prejuízo de outros direitos da Empresa.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">6. Garantias</h2>
              <p>
                Os trabalhos e equipamentos instalados beneficiam das garantias legalmente aplicáveis e das garantias
                específicas indicadas em cada orçamento, ficha de equipamento ou fatura. As garantias não cobrem danos
                resultantes de uso anormal, falta de manutenção, intervenção de terceiros não autorizados, ou desgaste
                natural.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">7. Portal do Cliente</h2>
              <p>
                O acesso ao Portal do Cliente é feito através de credenciais pessoais e intransmissíveis, criadas a
                convite da Empresa. O cliente é responsável pela confidencialidade da sua palavra-passe e por toda a
                atividade realizada com a sua conta. A Empresa reserva-se o direito de suspender o acesso em caso de
                uso indevido.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">8. Propriedade Intelectual</h2>
              <p>
                Os conteúdos deste site (textos, imagens, logótipo, design) são propriedade da Projetar Conforto ou
                utilizados com a devida autorização, sendo proibida a sua reprodução total ou parcial sem
                consentimento prévio.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">9. Limitação de Responsabilidade</h2>
              <p>
                A Empresa não se responsabiliza por atrasos ou incumprimentos resultantes de caso fortuito, força
                maior, ou de informação incompleta ou incorreta fornecida pelo cliente. Nada nestes Termos exclui ou
                limita direitos que não possam ser excluídos ou limitados ao abrigo da lei portuguesa aplicável à
                relação de consumo.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">10. Resolução Alternativa de Litígios</h2>
              <p>
                Em caso de litígio de consumo, o cliente pode recorrer a uma entidade de Resolução Alternativa de
                Litígios de Consumo (RAL). Mais informação e a lista de entidades disponíveis em{' '}
                <a href="https://www.consumidor.gov.pt" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">www.consumidor.gov.pt</a>{' '}
                e no Portal da Queixa Eletrónico. <strong>[Indicar aqui a entidade de RAL do setor/área geográfica em que a Empresa está inscrita, se aplicável]</strong>.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">11. Lei Aplicável e Foro</h2>
              <p>
                Estes Termos regem-se pela lei portuguesa. Para a resolução de qualquer litígio emergente destes
                Termos, é competente o tribunal da comarca do domicílio do consumidor, sem prejuízo de disposições
                legais imperativas em contrário.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-ink-800 mb-2">12. Alterações</h2>
              <p>
                A Empresa pode atualizar estes Termos periodicamente. A versão em vigor é sempre a publicada nesta
                página, com indicação da data da última atualização.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
