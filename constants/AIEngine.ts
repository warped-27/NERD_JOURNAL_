import { AIConfig } from './SecureStorage';

export interface AIInsights {
  summary: string;
  tags: string[];
  color: {
    light: string;
    dark: string;
  };
}

// Colori pastello predefiniti in base ai tag o come fallback
const PASTEL_COLORS = [
  { light: '#e8f5e9', dark: '#1b2e24' }, // Salvia
  { light: '#e3f2fd', dark: '#162b3d' }, // Azzurro
  { light: '#f3e5f5', dark: '#2d1b33' }, // Lilla
  { light: '#fff3e0', dark: '#3d2516' }, // Pesca
];

const FALLBACK_INSIGHTS: AIInsights = {
  summary: 'Nota salvata offline ed archiviata localmente.',
  tags: ['Locale'],
  color: PASTEL_COLORS[0],
};

// Funzione di pulizia per JSON estratti da LLM (gestisce blocchi di codice markdown ```json)
function parseLLMResponse(text: string): any {
  let cleaned = text.trim();
  
  // Rimuove markdown di blocco codice
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  
  return JSON.parse(cleaned.trim());
}

export const AIEngine = {
  async generateNoteInsights(text: string, aiConfig: AIConfig | null): Promise<AIInsights> {
    if (!aiConfig || aiConfig.provider === 'none') {
      return FALLBACK_INSIGHTS;
    }

    const prompt = `Analizza questa nota di diario e restituisci ESCLUSIVAMENTE un oggetto JSON valido (senza altre scritte di contorno o formattazione markdown) con questa struttura precisa:
{
  "summary": "un riassunto conciso in una singola frase breve (massimo 12 parole)",
  "tags": ["tag1", "tag2"],
  "colorIndex": 0, 1, 2 o 3 (scegli l'indice del colore pastello più adatto al tono: 0=Salvia/Sereno, 1=Azzurro/Tecnico, 2=Lilla/Personale-Studio, 3=Pesca/Idea-Energia)
}

Nota da analizzare:
"${text}"`;

    try {
      if (aiConfig.provider === 'gemini') {
        if (!aiConfig.apiKey) throw new Error('API Key Gemini mancante.');
        
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${aiConfig.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json'
              }
            })
          }
        );

        if (!response.ok) throw new Error(`Status HTTP Gemini: ${response.status}`);
        const data = await response.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) throw new Error('Risposta vuota da Gemini.');

        const parsed = parseLLMResponse(candidateText);
        const colorIdx = (typeof parsed.colorIndex === 'number' && parsed.colorIndex >= 0 && parsed.colorIndex < 4) ? parsed.colorIndex : 0;
        
        return {
          summary: parsed.summary || 'Nessuna sintesi generata.',
          tags: parsed.tags || ['AI'],
          color: PASTEL_COLORS[colorIdx]
        };
      }

      if (aiConfig.provider === 'openai') {
        if (!aiConfig.apiKey) throw new Error('API Key OpenAI mancante.');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Sei un analista di diari personali. Rispondi solo in formato JSON.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' }
          })
        });

        if (!response.ok) throw new Error(`Status HTTP OpenAI: ${response.status}`);
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('Risposta vuota da OpenAI.');

        const parsed = parseLLMResponse(content);
        const colorIdx = (typeof parsed.colorIndex === 'number' && parsed.colorIndex >= 0 && parsed.colorIndex < 4) ? parsed.colorIndex : 0;

        return {
          summary: parsed.summary || 'Nessuna sintesi generata.',
          tags: parsed.tags || ['AI'],
          color: PASTEL_COLORS[colorIdx]
        };
      }

      if (aiConfig.provider === 'ollama') {
        const endpoint = aiConfig.customEndpoint || 'http://localhost:11434';
        const model = aiConfig.modelName || 'llama3';

        const response = await fetch(`${endpoint}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            prompt: prompt,
            stream: false,
            format: 'json'
          })
        });

        if (!response.ok) throw new Error(`Status HTTP Ollama: ${response.status}`);
        const data = await response.json();
        const responseText = data.response;
        if (!responseText) throw new Error('Risposta vuota da Ollama.');

        const parsed = parseLLMResponse(responseText);
        const colorIdx = (typeof parsed.colorIndex === 'number' && parsed.colorIndex >= 0 && parsed.colorIndex < 4) ? parsed.colorIndex : 0;

        return {
          summary: parsed.summary || 'Nessuna sintesi generata.',
          tags: parsed.tags || ['AI'],
          color: PASTEL_COLORS[colorIdx]
        };
      }

      return FALLBACK_INSIGHTS;
    } catch (error) {
      console.warn('[AIEngine] Errore chiamata API IA, uso del fallback:', error);
      return FALLBACK_INSIGHTS;
    }
  }
};
