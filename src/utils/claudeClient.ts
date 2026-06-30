import { TrackerExercise } from '../types';

// Personal app, user-supplied key stored on-device: call the Messages API
// directly with fetch. The official SDK targets server/browser environments
// and would need dangerouslyAllowBrowser in React Native; raw fetch is the
// clean mobile path and keeps the bundle small.
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-8';

const PROMPT = `You are reading a photo of a handwritten gym workout-tracker page.
Transcribe it into JSON. Return ONLY the JSON object, no markdown, no commentary.

Schema:
{
  "title": string | null,            // e.g. "Monday - Chest", or null if none
  "exercises": [
    {
      "name": string,                // exercise name as written
      "sets": [
        { "reps": number | null, "weight": number | null, "notes": string | null }
      ]
    }
  ],
  "rawText": string                  // your best plain-text transcription of the whole page
}

Rules:
- One entry in "sets" per set actually written (e.g. "3x10 @ 60" -> three sets of reps 10, weight 60).
- Use null for any value you cannot read confidently. Do not invent numbers.
- "weight" is the number as written; ignore the unit (kg/lb).
- If the page is unreadable, return {"title": null, "exercises": [], "rawText": "<what you can see>"}.`;

export interface ParsedTracker {
  title: string | null;
  exercises: TrackerExercise[];
  rawText: string;
}

function extractJson(text: string): string {
  // Strip ```json fences or surrounding prose, then take the outermost {...}.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in the model response.');
  }
  return body.slice(start, end + 1);
}

export async function parseTrackerImage(
  base64Jpeg: string,
  apiKey: string,
): Promise<ParsedTracker> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: base64Jpeg },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err?.error?.message ? `: ${err.error.message}` : '';
    } catch {}
    if (res.status === 401) throw new Error(`Invalid API key${detail}`);
    if (res.status === 429) throw new Error(`Rate limited — try again shortly${detail}`);
    throw new Error(`Claude API error ${res.status}${detail}`);
  }

  const data = await res.json();
  const text: string = (data?.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
    .trim();

  const parsed = JSON.parse(extractJson(text));
  return {
    title: parsed.title ?? null,
    exercises: Array.isArray(parsed.exercises)
      ? parsed.exercises.map((e: any) => ({
          name: String(e?.name ?? 'Unknown'),
          sets: Array.isArray(e?.sets)
            ? e.sets.map((s: any) => ({
                reps: typeof s?.reps === 'number' ? s.reps : null,
                weight: typeof s?.weight === 'number' ? s.weight : null,
                notes: s?.notes ?? undefined,
              }))
            : [],
        }))
      : [],
    rawText: typeof parsed.rawText === 'string' ? parsed.rawText : text,
  };
}
