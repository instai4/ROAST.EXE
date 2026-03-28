// api/roast.js
// ROAST.exe — Multi-provider AI roast generator
// Supports: bio text, photo (base64), GitHub URL, LinkedIn URL
// Fallback chain: Grok (xAI) → Groq → Gemini
//
// Required env vars (Vercel dashboard):
//   XAI_API_KEY     — xAI / Grok   (https://console.x.ai)
//   GROQ_API_KEY    — Groq          (https://console.groq.com)
//   GEMINI_API_KEY  — Google Gemini (https://aistudio.google.com/app/apikey)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { mode, intensity, persona, content, url, photoBase64 } = req.body || {};

    if (!mode) return res.status(400).json({ error: 'Missing mode.' });

    // ── Build the roast subject description ──
    let subject = '';
    if (mode === 'bio') {
      subject = content || 'A person who refused to share anything about themselves';
    } else if (mode === 'photo') {
      subject = `A person in a photo${content ? `. Additional context: ${content}` : ''}`;
    } else if (mode === 'github') {
      subject = `GitHub developer${url ? ` at ${url}` : ''}${content ? `. Bio: ${content}` : ''}`;
    } else if (mode === 'linkedin') {
      subject = `LinkedIn professional${url ? ` at ${url}` : ''}${content ? `. About: ${content}` : ''}`;
    }

    // ── Intensity instructions ──
    const intensityMap = {
      mild: 'Be playful and friendly. Tease lightly like a good friend would. Keep it warm, no real burns.',
      savage: 'Be ruthless but clever. No topic is off-limits. Make it sting but be hilarious. Zero mercy.',
      nuclear: 'DESTROY them. Absolutely no filter. Make it the most brutal, savage, absurdist roast imaginable. Every sentence should be a gut punch. Go completely unhinged.',
    };
    const intensityInstr = intensityMap[intensity] || intensityMap.savage;

    // ── Persona voice ──
    const personaMap = {
      comedian:    'You are a stand-up comedian. Use timing, callbacks, and escalating punchlines. Sound like you\'re on stage.',
      gordon:      'You are Gordon Ramsay. Use kitchen metaphors. Call everything disgusting. Scream (in caps occasionally). "This person is RAW." energy.',
      shakespeare: 'You are Shakespeare. Use Early Modern English ("thou art", "forsooth", "verily"). Make poetic insults. Be theatrical and flowery yet vicious.',
      drill:       'You are a US Army Drill Sergeant. Bark orders. Use military metaphors. Everything is a failure of discipline. End sentences with "SOLDIER!"',
      therapist:   'You are a passive-aggressive therapist. Use therapy-speak. Say things like "I\'m sensing some deep insecurity here..." and "Let\'s unpack that." Make observations sound clinical but devastating.',
      'gen-z':     'You are a Gen-Z critic. Use slang (no cap, fr fr, mid, L + ratio, slay ironically, it\'s giving...). Roast through internet culture references. Short punchy sentences.',
      ai:          'You are a cold, emotionless AI analyzing this human specimen. Speak clinically. Use percentages and "assessments". Be devastatingly blunt through pure logic, no emotion.',
      villain:     'You are a theatrical supervillain. Monologue dramatically. Reference your evil plans. Call them a pathetic obstacle. Be grandiose and condescending.',
    };
    const personaInstr = personaMap[persona] || personaMap.comedian;

    // ── System prompt ──
    const systemPrompt = `You are ROAST.exe, the world's most ruthless AI roast machine built by Anurag Rajput.

${personaInstr}

${intensityInstr}

ROAST RULES:
1. Write 4-6 punchy paragraphs (each a separate line).
2. Each paragraph should land a different type of hit (appearance, career, personality, life choices, etc.).
3. End with one devastating closer that ties it all together.
4. Be CREATIVE and ORIGINAL — no generic insults. Make it specific to what they gave you.
5. Never break character. Stay in persona the entire time.
6. Do NOT add disclaimers, apologies, or say "just kidding".

After the roast, on a new line, output ONLY this JSON (nothing else after it):
SCORE:{"burnScore":8}

The burnScore is 1-10 based on how savage the roast was.`;

    const userMessage = mode === 'photo'
      ? `Roast this person based on their photo${content ? ' and this context: ' + content : ''}.`
      : `Roast this person: ${subject}`;

    // ── OpenAI-compatible messages ──
    const openAiMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    // ── Gemini-format messages ──
    const geminiContents = [{ role: 'user', parts: [{ text: userMessage }] }];

    // If photo mode and Gemini, add image part
    const geminiWithPhoto = photoBase64
      ? [{ role: 'user', parts: [
          { inline_data: { mime_type: 'image/jpeg', data: photoBase64 } },
          { text: userMessage }
        ]}]
      : geminiContents;

    const temperature = intensity === 'nuclear' ? 1.0 : intensity === 'savage' ? 0.9 : 0.7;

    // ─────────────────────────────────────────────
    // TIER 1 — GROK (xAI) — most unfiltered
    // ─────────────────────────────────────────────
    const XKEY = process.env.XAI_API_KEY;
    if (XKEY) {
      try {
        const r = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${XKEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'grok-3-mini',
            messages: openAiMessages,
            max_tokens: 1200,
            temperature
          })
        });
        const d = await r.json();
        if (r.ok) {
          const text = d?.choices?.[0]?.message?.content;
          if (text) {
            const parsed = parseRoastResponse(text);
            if (parsed) return res.status(200).json(parsed);
          }
        } else {
          console.log('[ROAST] Grok failed:', r.status, d?.error?.message);
        }
      } catch(e) { console.log('[ROAST] Grok error:', e.message); }
    }

    // ─────────────────────────────────────────────
    // TIER 2 — GROQ (free, fast)
    // ─────────────────────────────────────────────
    const GQKEY = process.env.GROQ_API_KEY;
    if (GQKEY) {
      const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
      for (const model of groqModels) {
        try {
          const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GQKEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: openAiMessages, max_tokens: 1200, temperature })
          });
          const d = await r.json();
          if (r.ok) {
            const text = d?.choices?.[0]?.message?.content;
            if (text) {
              const parsed = parseRoastResponse(text);
              if (parsed) return res.status(200).json(parsed);
            }
          } else {
            console.log(`[ROAST] Groq ${model} failed:`, r.status, d?.error?.message);
          }
        } catch(e) { console.log(`[ROAST] Groq ${model} error:`, e.message); }
      }
    }

    // ─────────────────────────────────────────────
    // TIER 3 — GEMINI (supports photo via vision)
    // ─────────────────────────────────────────────
    const GKEY = process.env.GEMINI_API_KEY;
    if (GKEY) {
      // Use vision model if photo is present
      const geminiModels = photoBase64
        ? ['gemini-1.5-flash', 'gemini-2.0-flash-lite']
        : ['gemini-2.0-flash-lite', 'gemini-1.5-flash-8b', 'gemini-2.5-flash'];

      for (const model of geminiModels) {
        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GKEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: geminiWithPhoto,
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: { maxOutputTokens: 1200, temperature }
              })
            }
          );
          const d = await r.json();
          if (r.ok) {
            const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = parseRoastResponse(text);
              if (parsed) return res.status(200).json(parsed);
            }
          } else {
            console.log(`[ROAST] Gemini ${model} failed:`, r.status, d?.error?.message);
          }
        } catch(e) { console.log(`[ROAST] Gemini ${model} error:`, e.message); }
      }
    }

    return res.status(500).json({ error: 'All AI providers failed. Check your API keys.' });

  } catch(e) {
    console.error('[ROAST] Handler error:', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}

// ── Parse roast text + score from AI response ──
function parseRoastResponse(text) {
  try {
    // Extract score JSON after SCORE: marker
    const scoreMatch = text.match(/SCORE:\s*(\{[^}]+\})/);
    let burnScore = 7;
    if (scoreMatch) {
      try { burnScore = JSON.parse(scoreMatch[1]).burnScore || 7; } catch {}
    }

    // Clean roast text — remove the SCORE line
    const roast = text.replace(/SCORE:\s*\{[^}]+\}/g, '').trim();

    if (!roast) return null;
    return { roast, burnScore: Math.min(10, Math.max(1, burnScore)) };
  } catch { return null; }
}