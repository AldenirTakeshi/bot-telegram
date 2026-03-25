export const BotMessages = {
  GREETING: `Olá! Sou o *PocketGuard AI* 💰 — seu assistente de controle de gastos.\n\nMinha função é simples: te dizer *quanto você ainda pode gastar* no mês sem estourar o orçamento.\n\nComo posso te ajudar:\n\n💸 *Registrar gasto:* "Mercado 81"\n💵 *Ver saldo:* "Quanto tenho?"\n🤔 *Consultar compra:* "Posso comprar um tênis de 400?"\n📊 *Relatório:* "relatório do mês"\n📋 *Ver todos os gastos:* "gastos do mês"\n\nSe ainda não configurou seu perfil, envie /start para começar!`,

  WELCOME: `Olá! Sou o *PocketGuard AI* 💰\n\nVou te ajudar a controlar seus gastos com uma única pergunta: *"Quanto ainda posso gastar?"*\n\nVamos configurar seu perfil. Qual é a sua *renda total mensal*? (ex: 10500)`,

  ONBOARDING_INVESTMENT: (ceiling: number) =>
    `Ótimo! Agora, qual é o seu *objetivo de investimento mensal*? (ex: 1000)\n\nSeu teto de gastos será calculado automaticamente.`,

  ONBOARDING_CEILING_CONFIRM: (income: number, investment: number, ceiling: number) =>
    `✅ Configurado!\n\n💰 Renda: *R$ ${formatCurrency(income)}*\n📈 Investimento: *R$ ${formatCurrency(investment)}*\n🎯 Teto de gastos: *R$ ${formatCurrency(ceiling)}*\n\nAgora vamos cadastrar seus *gastos fixos* (aluguel, luz, internet, etc).\n\nDigite um gasto fixo no formato: *Nome Valor* (ex: Aluguel 2000)\nOu envie *pronto* para pular.`,

  ONBOARDING_FIXED_ADDED: (name: string, amount: number) =>
    `✅ *${name}* — R$ ${formatCurrency(amount)} adicionado.\n\nDigite outro gasto fixo ou envie *pronto* para finalizar.`,

  ONBOARDING_COMPLETE: (ceiling: number, fixedTotal: number, freeBalance: number) =>
    `🎉 *Configuração concluída!*\n\n📊 Resumo do mês:\n• Teto: R$ ${formatCurrency(ceiling)}\n• Fixos: R$ ${formatCurrency(fixedTotal)}\n• *Saldo livre: R$ ${formatCurrency(freeBalance)}*\n\nAgora é só mandar seus gastos! Ex: "Mercado 81" ou "iFood 45"`,

  EXPENSE_REGISTERED: (category: string, amount: number, remaining: number, registeredBy?: string) =>
    `✅ *${category}*: R$ ${formatCurrency(amount)} registrado${registeredBy ? ` por *${registeredBy}*` : ''}.\n\n💵 Saldo restante: *R$ ${formatCurrency(remaining)}*`,

  BALANCE_QUERY: (remaining: number, burnRate: number, daysLeft: number) =>
    `💵 *Saldo restante: R$ ${formatCurrency(remaining)}*\n\n📊 ${burnRate.toFixed(1)}% do teto variável gasto\n📅 ${daysLeft} dias restantes no mês`,

  CAN_BUY_YES: (amount: number, projectedRemaining: number) =>
    `✅ *Sim, você pode comprar!*\n\nApós a compra de R$ ${formatCurrency(amount)}, sua projeção para o fim do mês seria:\n💵 R$ ${formatCurrency(projectedRemaining)} de sobra`,

  CAN_BUY_NO: (amount: number, projectedRemaining: number) =>
    `❌ *Cuidado!* Essa compra pode comprometer seu mês.\n\nCom R$ ${formatCurrency(amount)} a mais, sua projeção seria *-R$ ${formatCurrency(Math.abs(projectedRemaining))}* no vermelho.`,

  FIXED_ADDED: (name: string, amount: number) =>
    `✅ Gasto fixo *${name}* — R$ ${formatCurrency(amount)} adicionado.`,

  CARD_UPDATED: (name: string, currentAmount: number) =>
    `✅ Fatura *${name}* atualizada: R$ ${formatCurrency(currentAmount)}`,

  CEILING_UPDATED: (ceiling: number) =>
    `✅ Teto de gastos atualizado: *R$ ${formatCurrency(ceiling)}*`,

  MONTHLY_REPORT: (
    month: string,
    ceiling: number,
    fixedTotal: number,
    variableSpent: number,
    remaining: number,
    topCategories: { category: string; total: number }[],
  ) => {
    const burnRate = ceiling > 0 ? ((variableSpent / ceiling) * 100) : 0;
    const categoryLines = topCategories
      .slice(0, 5)
      .map((c) => `  • ${c.category}: R$ ${formatCurrency(c.total)}`)
      .join('\n');
    const statusLine = remaining >= 0
      ? `💚 Você ainda tem *R$ ${formatCurrency(remaining)}* disponível no teto.`
      : `🔴 Você estourou o teto em *R$ ${formatCurrency(Math.abs(remaining))}*.`;
    return (
      `📊 *Relatório — ${month}*\n\n` +
      `🎯 Teto: R$ ${formatCurrency(ceiling)}\n` +
      `🔒 Fixos: R$ ${formatCurrency(fixedTotal)}\n` +
      `💸 Variáveis: R$ ${formatCurrency(variableSpent)} *(${burnRate.toFixed(1)}% do teto)*\n\n` +
      `${statusLine}` +
      (categoryLines ? `\n\n📈 *Onde mais gastou:*\n${categoryLines}` : '')
    );
  },

  CEILING_ALERT: (burnRate: number, remaining: number) => {
    const emoji = burnRate >= 90 ? '🔶' : '⚠️';
    const tip = burnRate >= 90
      ? 'Cuidado, você está quase no limite!'
      : 'Vá com calma nos próximos dias! 🐢';
    return `${emoji} *Atenção!* Você já usou *${Math.floor(burnRate)}%* do seu teto de gastos variáveis.\n\n💵 Restam apenas *R$ ${formatCurrency(remaining)}*. ${tip}`;
  },

  CEILING_ALERT_100: (overAmount: number) =>
    `🔴 *Teto estourado!* Você ultrapassou seu limite em *R$ ${formatCurrency(overAmount)}*.\n\nConsidere revisar seus gastos ou ajustar o teto com: "Meu teto é [valor]"`,

  DELETE_LAST_SUCCESS: (category: string, amount: number) =>
    `✅ Último gasto removido: *${category}* — R$ ${formatCurrency(amount)}`,

  DELETE_LAST_EMPTY: `📭 Nenhum gasto encontrado para remover.`,

  LIST_EXPENSES_EMPTY: (period: string) => {
    const label = period === 'today' ? 'hoje' : period === 'week' ? 'essa semana' : 'este mês';
    return `📭 Nenhum gasto registrado ${label}.`;
  },

  LIST_EXPENSES: (expenses: { category: string; amount: number; description?: string | null }[], period: string) => {
    const title = period === 'today' ? '📋 *Gastos de hoje:*' : '📋 *Gastos da semana:*';
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const lines = expenses.map(
      (e) => `• *${e.category}*: R$ ${formatCurrency(e.amount)}${e.description ? ` (${e.description})` : ''}`,
    );
    return `${title}\n\n${lines.join('\n')}\n\n💸 Total: R$ ${formatCurrency(total)}`;
  },

  HELP_MENU: `*PocketGuard AI — Como usar:*\n\n💸 *Registrar gasto:* "Mercado 81" ou "iFood 45"\n💵 *Ver saldo:* "Quanto tenho?" ou "saldo"\n🤔 *Consultar compra:* "Posso comprar um tênis de 400?"\n📊 *Relatório:* "relatório do mês"\n🔧 *Configurar teto:* "Meu teto é 9500"\n➕ *Adicionar fixo:* "Aluguel 2000 todo dia 5"\n💳 *Atualizar cartão:* "Cartão Nubank mais 150"\n📋 *Ver fixos:* "quais são meus fixos?"\n📅 *Gastos de hoje:* "o que gastei hoje?"\n📅 *Gastos da semana:* "gastos da semana"\n↩️ *Desfazer último:* "desfazer" ou "undo"\n\n/start — Reconfigurar perfil\n/parceiro — Modo Casal`,

  UNKNOWN_COMMAND: `Não entendi 🤔\n\nTente algo como:\n• "Mercado 81"\n• "Quanto tenho?"\n• "Posso comprar um tênis de 400?"\n\nOu envie /start para ver todas as opções.`,

  PARSE_CONFIRM: (text: string) =>
    `Não consegui interpretar "${text}" com certeza.\n\nVocê quis dizer um gasto? Se sim, responda no formato:\n*Categoria Valor* (ex: Mercado 81)`,
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
