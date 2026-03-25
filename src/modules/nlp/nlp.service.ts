import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ParsedIntent } from './dto/parsed-intent.dto';
import { SYSTEM_PROMPT } from './nlp.prompts';

@Injectable()
export class NlpService {
  private readonly logger = new Logger(NlpService.name);
  private anthropic: Anthropic | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — NLP running in stub mode (rule-based fallback)');
    }
  }

  async parse(text: string): Promise<ParsedIntent> {
    if (!this.anthropic) {
      return this.stubParse(text);
    }

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return this.unknownIntent();
      }

      const parsed = JSON.parse(content.text) as ParsedIntent;
      return {
        intent: parsed.intent ?? 'UNKNOWN',
        category: parsed.category ?? undefined,
        amount: parsed.amount ?? undefined,
        description: parsed.description ?? undefined,
        fixedName: parsed.fixedName ?? undefined,
        dayOfMonth: parsed.dayOfMonth ?? undefined,
        confidence: parsed.confidence ?? 'low',
      };
    } catch (err) {
      this.logger.error(`NLP parse error for text "${text}":`, err);
      return this.unknownIntent();
    }
  }

  private stubParse(text: string): ParsedIntent {
    const lower = text.toLowerCase().trim();

    // GREETING
    if (/^(oi|olá|ola|opa|eae|e aí|e ai|hey|hello|bom dia|boa tarde|boa noite|tudo bem|tudo bom|fala|fala comigo|me ajuda|como funciona|o que você faz|o que voce faz|quem é você|quem e voce|ajuda)[\s!?.,]*$/.test(lower)) {
      return { intent: 'GREETING', confidence: 'high' };
    }

    // DELETE_LAST / UNDO
    if (/desfazer|undo|deletar [uú]ltimo|apagar [uú]ltimo|errei|cancela|remover [uú]ltimo/.test(lower)) {
      return { intent: 'DELETE_LAST', confidence: 'high' };
    }

    // DELETE_FIXED — "remover Aluguel" / "excluir Spotify"
    const deleteFixedMatch = lower.match(/(?:remover|excluir|deletar|apagar)\s+(?!.*(gasto|despesa|lan[cç]amento))(.+)/);
    if (deleteFixedMatch && !lower.includes('último') && !lower.includes('ultimo')) {
      return { intent: 'DELETE_FIXED', fixedName: deleteFixedMatch[2].trim(), confidence: 'high' };
    }

    // UPDATE_FIXED — "alterar Aluguel 2200" / "mudar Spotify para 35"
    const updateFixedMatch = lower.match(/(?:alterar|mudar|atualizar)\s+(.+?)\s+(?:para\s+)?(\d+[.,]?\d*)/);
    if (updateFixedMatch) {
      return { intent: 'UPDATE_FIXED', fixedName: updateFixedMatch[1].trim(), amount: parseFloat(updateFixedMatch[2].replace(',', '.')), confidence: 'high' };
    }

    // LIST_FIXED
    if (/fixos|gastos fixos|lista.*fixo|quais.*fixos|meus fixos/.test(lower)) {
      return { intent: 'LIST_FIXED', confidence: 'high' };
    }

    // LIST_EXPENSES
    if (/gastei hoje|gastos (de |do )?hoje|o que gastei hoje/.test(lower)) {
      return { intent: 'LIST_EXPENSES', period: 'today', confidence: 'high' };
    }
    if (/gastei (essa|esta) semana|gastos da semana|semana/.test(lower)) {
      return { intent: 'LIST_EXPENSES', period: 'week', confidence: 'high' };
    }
    if (/gastos do m[eê]s|tudo (que |o que )?gastei|discriminado|extrato|todos os gastos|listagem/.test(lower)) {
      return { intent: 'LIST_EXPENSES', period: 'all', confidence: 'high' };
    }
    if (/o que gastei/.test(lower)) {
      return { intent: 'LIST_EXPENSES', period: 'today', confidence: 'high' };
    }

    // QUERY_BALANCE
    if (/saldo|quanto (tenho|sobrou|posso gastar)|quanto (me) (resta|sobra)/.test(lower)) {
      return { intent: 'QUERY_BALANCE', confidence: 'high' };
    }

    // MONTHLY_REPORT
    if (/relat[oó]rio|resumo (do|mensal)|como foi (o|meu) m[eê]s/.test(lower)) {
      return { intent: 'MONTHLY_REPORT', confidence: 'high' };
    }

    // CAN_I_BUY — "posso comprar X de Y"
    const canBuyMatch = lower.match(/posso comprar.+?(\d+[.,]?\d*)/);
    if (canBuyMatch) {
      return { intent: 'CAN_I_BUY', amount: parseFloat(canBuyMatch[1].replace(',', '.')), confidence: 'high' };
    }

    // SETUP_CEILING — "meu teto é X" or "teto X"
    const ceilingMatch = lower.match(/(?:meu\s+)?teto\s+(?:[eé]\s+)?(\d+[.,]?\d*)/);
    if (ceilingMatch) {
      return { intent: 'SETUP_CEILING', amount: parseFloat(ceilingMatch[1].replace(',', '.')), confidence: 'high' };
    }

    // UPDATE_CARD — "cartão X mais Y"
    const cardMatch = lower.match(/cart[aã]o\s+(\w+)\s+(?:mais\s+|\+\s*)?(\d+[.,]?\d*)/);
    if (cardMatch) {
      return { intent: 'UPDATE_CARD', fixedName: cardMatch[1], amount: parseFloat(cardMatch[2].replace(',', '.')), confidence: 'high' };
    }

    // ADD_FIXED — "adiciona/adicionar X Y"
    const addFixedMatch = lower.match(/(?:adiciona(?:r)?|novo fixo)\s+(.+?)\s+(\d+[.,]?\d*)/);
    if (addFixedMatch) {
      return { intent: 'ADD_FIXED', fixedName: addFixedMatch[1], amount: parseFloat(addFixedMatch[2].replace(',', '.')), confidence: 'high' };
    }

    // REGISTER_EXPENSE — "Category Value" (most common pattern)
    const CATEGORIES = ['mercado', 'alimentação', 'alimentacao', 'transporte', 'lazer', 'saúde', 'saude', 'cartão', 'cartao', 'outros', 'ifood', 'farmácia', 'farmacia', 'uber', 'gasolina', 'restaurante'];
    const expenseMatch = text.trim().match(/^(.+?)\s+(\d+[.,]?\d*)$/);
    if (expenseMatch) {
      const name = expenseMatch[1].toLowerCase();
      const amount = parseFloat(expenseMatch[2].replace(',', '.'));
      const knownCategory = CATEGORIES.find((c) => name.includes(c));
      const category = knownCategory
        ? knownCategory.charAt(0).toUpperCase() + knownCategory.slice(1)
        : 'Outros';
      return { intent: 'REGISTER_EXPENSE', category, amount, description: expenseMatch[1], confidence: 'high' };
    }

    return this.unknownIntent();
  }

  private unknownIntent(): ParsedIntent {
    return { intent: 'UNKNOWN', confidence: 'low' };
  }
}
