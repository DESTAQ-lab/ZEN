import type { LucideIcon } from 'lucide-react';
import {
  MessageCircle,
  ImagePlus,
  TrendingDown,
  PackageCheck,
} from 'lucide-react';

type Step = {
  id: number;
  title: string;
  description: string;
  Icon: LucideIcon;
};

const STEPS: Step[] = [
  {
    id: 1,
    title: 'Atendimento Humanizado',
    description:
      'Entre em contato diretamente com nossas vendedoras. Um atendimento rapido e focado no que voce precisa.',
    Icon: MessageCircle,
  },
  {
    id: 2,
    title: 'Envie sua Referencia',
    description:
      'Tem a foto do que procura? Pode nos enviar! Trabalhamos com imagens de referencia para encontrar exatamente o seu produto.',
    Icon: ImagePlus,
  },
  {
    id: 3,
    title: 'O Melhor Preco',
    description:
      'Nossa equipe entra em acao para buscar o melhor preco de atacado do mercado para voce.',
    Icon: TrendingDown,
  },
  {
    id: 4,
    title: 'Retirada Expressa',
    description:
      'Agilizamos todo o processo. Seu pedido fica separado e pronto para ser retirado em ate 3 dias uteis.',
    Icon: PackageCheck,
  },
];

export default function HowWeWork() {
  return (
    <section className="bg-sky-50 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
          <span className="inline-flex rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Como funciona
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Seu processo de compra, claro e sem complicacao
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
            Um fluxo simples, visual e rapido para voce comprar com seguranca.
          </p>
        </div>

        <div className="relative">
          <div
            className="pointer-events-none absolute left-1/2 top-12 hidden h-px w-[78%] -translate-x-1/2 bg-gradient-to-r from-transparent via-sky-200 to-transparent lg:block"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-4">
            {STEPS.map(({ id, title, description, Icon }) => (
              <article
                key={id}
                className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700 transition-colors duration-300 group-hover:bg-sky-600 group-hover:text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                    Passo {id}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
