import crypto from 'crypto';
import axios from 'axios';
import { env } from '../config/env';
import { LoadedMessage } from '../repositories/SessionAnalysisRepository';

type AnalysisScriptResolved = {
  scriptKey: string;
  scriptVersion: number;
  analysisVersionTag: string;
  scriptText: string;
  topics: unknown;
};

export class SessionAnalysisModelService {
  buildPrompt(input: { script: AnalysisScriptResolved; messages: LoadedMessage[] }) {
    const topicsJson = JSON.stringify(Array.isArray(input.script.topics) ? input.script.topics : [], null, 2);

    const messagesPayload = input.messages.map((m) => {
      const ts = (m.updatedAtExternal ?? m.createdAtExternal ?? m.createdAt) as any as Date;
      return {
        messageId: m.id,
        timestamp: new Date(ts).toISOString(),
        fromMe: m.fromMe,
        senderType: m.senderType,
        mediaType: m.mediaType ?? null,
        mediaUrl: m.mediaUrl ?? null,
        body: m.body ?? '',
      };
    });

    const prompt = [
      `Você é um avaliador de atendimento.`,
      ``,
      `Contexto do script (rubrica):`,
      input.script.scriptText,
      ``,
      `Checklist estruturado (topics):`,
      topicsJson,
      ``,
      `Regras importantes:`,
      `- fromMe=true representa ATENDENTE (outbound). fromMe=false representa CLIENTE (inbound).`,
      `- Sua resposta DEVE ser SOMENTE JSON válido (sem markdown).`,
      `- Não invente fatos. Se houver mídia (ex: audio) sem transcrição, não invente conteúdo; trate como "conteúdo não disponível".`,
      `- Evidências devem referenciar messageId e um excerpt curto do body quando existir.`,
      `- Se um tópico não puder ser avaliado por falta de dados, marque passed=false e explique em notes.`,
      ``,
      `Gere um relatório no schema solicitado, preenchendo:`,
      `- analysisVersionTag=${input.script.analysisVersionTag}`,
      `- scriptKey=${input.script.scriptKey}`,
      `- scriptVersion=${input.script.scriptVersion}`,
      ``,
      `Mensagens (ordenadas por timestamp):`,
      JSON.stringify(messagesPayload, null, 2),
      ``,
    ].join('\n');

    const promptHash = crypto.createHash('sha256').update(prompt, 'utf8').digest('hex');
    return { prompt, promptHash };
  }

  private getReportSchema() {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        analysisVersionTag: { type: 'string' },
        scriptKey: { type: 'string' },
        scriptVersion: { type: 'integer' },
        overallScore: { type: 'integer', minimum: 0, maximum: 100 },
        temperature: { type: 'string', enum: ['cold', 'neutral', 'warm', 'hot'] },
        summary: { type: 'string' },
        checklist: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              key: { type: 'string' },
              label: { type: 'string' },
              passed: { type: 'boolean' },
              score: { type: 'integer', minimum: 0, maximum: 100 },
              notes: { type: 'string' },
            },
            required: ['key', 'label', 'passed', 'score', 'notes'],
          },
        },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              key: { type: 'string' },
              severity: { type: 'string', enum: ['low', 'medium', 'high'] },
              notes: { type: 'string' },
              evidence: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    messageId: { type: 'string' },
                    excerpt: { type: 'string' },
                  },
                  required: ['messageId', 'excerpt'],
                },
              },
            },
            required: ['key', 'severity', 'notes', 'evidence'],
          },
        },
        highlights: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              key: { type: 'string' },
              notes: { type: 'string' },
              evidence: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    messageId: { type: 'string' },
                    excerpt: { type: 'string' },
                  },
                  required: ['messageId', 'excerpt'],
                },
              },
            },
            required: ['key', 'notes', 'evidence'],
          },
        },
        recommendations: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'analysisVersionTag',
        'scriptKey',
        'scriptVersion',
        'overallScore',
        'temperature',
        'summary',
        'checklist',
        'issues',
        'highlights',
        'recommendations',
      ],
    };
  }

  private extractJsonText(response: any): string {
    if (response && typeof response.output_text === 'string' && response.output_text.trim()) {
      return response.output_text.trim();
    }

    const output = response?.output;
    if (Array.isArray(output)) {
      for (const item of output) {
        const content = item?.content;
        if (!Array.isArray(content)) continue;
        for (const c of content) {
          const text = c?.text ?? c?.value ?? null;
          if (typeof text === 'string' && text.trim()) return text.trim();
        }
      }
    }

    if (response?.choices?.[0]?.message?.content && typeof response.choices[0].message.content === 'string') {
      return response.choices[0].message.content.trim();
    }

    throw new Error('Unable to extract model output text');
  }

  async generateReport(input: { script: AnalysisScriptResolved; messages: LoadedMessage[] }) {
    const { prompt, promptHash } = this.buildPrompt(input);
    const model = env.OPENAI_MODEL ?? 'gpt-5-mini';

    if (!env.OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/responses',
      {
        model,
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'session_analysis_report',
            strict: true,
            schema: this.getReportSchema(),
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
      }
    );

    const payload = response.data;
    const jsonText = this.extractJsonText(payload);
    const report = JSON.parse(jsonText);

    return { report, model: String(payload?.model ?? model), promptHash };
  }
}
