import { CategorySpend } from '../../modules/expenses/expenses.service';

function fmt(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildBurnRateAlert(
  burnRate: number,
  topCategory: string,
  remaining: number,
  dayOfMonth: number,
): string {
  return (
    `⚠️ *Alerta de Gastos — Dia ${dayOfMonth}*\n\n` +
    `Você já gastou *${burnRate.toFixed(1)}%* do seu teto variável.\n` +
    `💸 Maior categoria: *${topCategory}*\n` +
    `💵 Saldo restante: R$ ${fmt(remaining)}\n\n` +
    `Ainda faltam ${31 - dayOfMonth} dias no mês. Vá com calma! 🐢`
  );
}

export function buildMonthlyReport(
  month: string,
  ceiling: number,
  fixedTotal: number,
  variableSpent: number,
  remaining: number,
  topCategories: CategorySpend[],
): string {
  const [year, monthNum] = month.split('-');
  const monthName = new Date(Number(year), Number(monthNum) - 1, 1).toLocaleString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  const categoryLines = topCategories
    .slice(0, 3)
    .map((c) => `  • ${c.category}: R$ ${fmt(c.total)}`)
    .join('\n');

  const status = remaining >= 0 ? '✅ Fechou no azul!' : '❌ Fechou no vermelho.';

  return (
    `📊 *Relatório de Fechamento — ${monthName}*\n\n` +
    `🎯 Teto: R$ ${fmt(ceiling)}\n` +
    `🔒 Fixos: R$ ${fmt(fixedTotal)}\n` +
    `💸 Variáveis: R$ ${fmt(variableSpent)}\n` +
    `💵 *Resultado: R$ ${fmt(Math.abs(remaining))} ${remaining >= 0 ? 'de sobra' : 'estourado'}*\n\n` +
    `${status}\n\n` +
    `📈 *Top categorias:*\n${categoryLines || '  Nenhum gasto registrado'}`
  );
}
