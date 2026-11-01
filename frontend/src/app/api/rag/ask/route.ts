import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireSessionFromRequest } from '@/lib/auth-server';
import { addQuestion, listUserFiles } from '@/lib/data-store';
import { Citation } from '@/lib/models';
import { retrieveUserChunks } from '@/lib/pipeline';
import { getUserProfile } from '@/lib/profile-store';
import { writeRetrievalRecord, writeStudentProfileSnapshot } from '@/lib/rag-records';

type SupportState = 'SUPPORTED' | 'PARTIAL' | 'INSUFFICIENT';
type LLMResult =
  | { kind: 'ok'; answer: string; supportState: SupportState; usedEvidenceTags: string[] }
  | { kind: 'insufficient' }
  | { kind: 'provider_error'; statusCode?: number; errorMessage: string };

function cleanExtractionText(text: string) {
  return (text || '')
    .replace(/[\uFFFD□■▪◦●◆]+/g, ' ')
    .replace(/\uFFFD/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tokenize(text: string) {
  return (String(text || '').toLowerCase().match(/[a-z0-9_]+/g) || []).filter((t) => t.length > 2);
}

function keywordOverlapScore(query: string, text: string) {
  const q = new Set(tokenize(query));
  if (q.size === 0) return 0;
  const t = new Set(tokenize(text));
  let hits = 0;
  for (const tok of q) if (t.has(tok)) hits += 1;
  return hits / q.size;
}

function parseTagIndex(tag: string): number | null {
  const m = String(tag || '').trim().match(/^E(\d+)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n - 1 : null;
}

function stripStoredPrefix(fileName: string) {
  const s = String(fileName || '');
  return s.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '');
}

function inferSubjectFromFileName(fileName: string) {
  const f = stripStoredPrefix(fileName).toLowerCase();
  if (f.includes('reinforcement') || f.includes('vision') || f.includes('learning')) return 'AI Foundations in Practice';
  if (f.includes('mapreduce') || f.includes('spark') || f.includes('big') || f.includes('ml')) return 'Big Data And Machine Learning Applications';
  if (f.includes('visual') || f.includes('viz') || f.includes('dashboard')) return 'Data Visualisation And Exploratory Analytics';
  if (f.includes('text') || f.includes('nlp') || f.includes('cluster')) return 'Intelligent Data And Text Analytics';
  if (f.includes('week') || f.includes('programming') || f.includes('analysis')) return 'Programming for Data Analysis and AI';
  return 'Unknown Subject';
}

function toCitations(results: any[], query: string, usedEvidenceTags: string[] = []): Citation[] {
  const taggedIdx = Array.from(new Set(usedEvidenceTags.map(parseTagIndex).filter((n): n is number => n !== null)));

  let selected: any[] = [];

  if (taggedIdx.length > 0) {
    selected = taggedIdx
      .map((i) => results[i])
      .filter(Boolean)
      .filter((r) => keywordOverlapScore(query, String(r.chunk_text || '')) >= 0.08);
  }

  // Fallback if model does not return usable tags or tags are too weak
  if (selected.length === 0) {
    selected = results
      .filter((r) => keywordOverlapScore(query, String(r.chunk_text || '')) >= 0.12)
      .slice(0, 4);
  }

  // Final safety fallback
  if (selected.length === 0) {
    selected = results.slice(0, 2);
  }

  return selected.slice(0, 4).map((r: any) => ({
    module: r.module || 'Unknown Subject',
    file: stripStoredPrefix(r.file || 'Unknown'),
    location: `${String(r.unit_type || 'page').toLowerCase() === 'slide' ? 'Slide' : 'Page'} ${r.page_or_slide ?? '?'}`,
    snippet: cleanExtractionText(String(r.chunk_text || '')).slice(0, 320),
  }));
}

function fallbackInsufficient(): LLMResult {
  return { kind: 'insufficient' };
}

function providerUnavailable(statusCode: number | undefined, errorMessage: string): LLMResult {
  return { kind: 'provider_error', statusCode, errorMessage };
}

function extractJsonObject(raw: string) {
  const text = (raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1]);
      } catch {}
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {}
    }
    return null;
  }
}

function parseRequestedWordCount(query: string): number | null {
  const m = (query || '').toLowerCase().match(/\b(\d{2,4})\s*words?\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.max(80, Math.min(500, n));
}

function wordCount(text: string): number {
  return (String(text || '').trim().match(/\S+/g) || []).length;
}

type ChatTurn = { role: 'user' | 'assistant'; content: string };

async function groundedLLMAnswer(query: string, mode: 'answer' | 'summary', evidence: any[], chatHistory: ChatTurn[] = []): Promise<LLMResult> {
  if (!evidence.length) return fallbackInsufficient();

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.RAG_LLM_MODEL || 'gemini-3.8-flash';
  if (!apiKey) {
    return providerUnavailable(undefined, 'GEMINI_API_KEY is missing');
  }

  const targetWords = parseRequestedWordCount(query);
  const context = evidence.slice(0, 8).map((r: any, i: number) => {
    const tag = `E${i + 1}`;
    const loc = `${String(r.unit_type || 'page').toLowerCase() === 'slide' ? 'Slide' : 'Page'} ${r.page_or_slide ?? '?'}`;
    return `${tag} | Module=${r.module || 'General'} | File=${r.file || 'Unknown'} | Location=${loc}\n${cleanExtractionText(String(r.chunk_text || '')).slice(0, 1200)}`;
  }).join('\n\n');

  const lengthRule = targetWords
    ? `When evidence is sufficient, make answer length around ${targetWords} words (acceptable range: ${Math.floor(targetWords * 0.9)}-${Math.ceil(targetWords * 1.1)} words).`
    : 'Keep the answer concise unless the user asks for a specific word count.';

  const policy = [
    'You are a strictly grounded academic assistant.',
    'Use only the provided evidence blocks (E1..E8).',
    'Do not use outside knowledge or model memory.',
    'If evidence is missing, weak, or ambiguous, return INSUFFICIENT.',
    'Never fabricate facts, citations, modules, file names, or locations.',
    lengthRule,
    mode === 'summary'
      ? 'Output strict JSON with keys: support_state, answer, citations_used. answer must be clear revision bullets/short paragraphs grounded in evidence.'
      : 'Output strict JSON with keys: support_state, answer, citations_used. answer must directly answer the query and stay grounded.',
    'support_state must be exactly one of: SUPPORTED, PARTIAL, INSUFFICIENT.',
    'citations_used must be an array of evidence tags like ["E1","E3"] that directly support the answer.',
    'If support_state is INSUFFICIENT, set answer exactly to INSUFFICIENT and citations_used to [].',
  ].join(' ');

  const historyBlock = (chatHistory || []).slice(-6).map((t, i) => `${i + 1}. ${t.role.toUpperCase()}: ${String(t.content || '').slice(0, 500)}`).join('\n');
  const userPrompt = `Conversation history (latest turns, optional):\n${historyBlock || 'None'}\n\nCurrent query: ${query}\n\nEvidence:\n${context}`;

  const callGemini = async (systemPolicy: string, promptText: string): Promise<LLMResult> => {
    const body = JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPolicy }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    let lastStatus: number | undefined;
    let lastErrText = '';

    for (let attempt = 1; attempt <= 3; attempt++) {
      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body,
        });
      } catch (e: any) {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 700 * attempt));
          continue;
        }
        return providerUnavailable(undefined, e?.message || 'Network error while calling Gemini');
      }

      if (!res.ok) {
        lastStatus = res.status;
        lastErrText = await res.text().catch(() => '');
        if ((res.status === 429 || res.status === 503) && attempt < 3) {
          await new Promise((r) => setTimeout(r, 900 * attempt));
          continue;
        }
        return providerUnavailable(res.status, lastErrText?.slice(0, 500) || `Gemini HTTP ${res.status}`);
      }

      let data: any;
      try {
        data = await res.json();
      } catch (e: any) {
        return providerUnavailable(res.status, e?.message || 'Invalid JSON from Gemini');
      }

      const content = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('\n').trim();
      const parsed = extractJsonObject(content);
      if (!parsed) {
        return providerUnavailable(res.status, 'Gemini returned non-JSON/invalid schema output');
      }

      const state = (parsed.support_state || 'INSUFFICIENT') as SupportState;
      const answer = String(parsed.answer || '').trim() || 'INSUFFICIENT';
      const citationsUsed = Array.isArray(parsed.citations_used)
        ? parsed.citations_used.map((x: any) => String(x).trim()).filter((x: string) => /^E\d+$/i.test(x))
        : [];

      if (!['SUPPORTED', 'PARTIAL', 'INSUFFICIENT'].includes(state)) {
        return providerUnavailable(res.status, `Unexpected support_state: ${String(parsed.support_state)}`);
      }
      if (answer.toUpperCase() === 'INSUFFICIENT' || state === 'INSUFFICIENT') return fallbackInsufficient();
      return { kind: 'ok', answer, supportState: state, usedEvidenceTags: citationsUsed };
    }

    return providerUnavailable(lastStatus, lastErrText?.slice(0, 500) || 'Gemini unavailable after retries');
  };


  const first = await callGemini(policy, userPrompt);
  if (first.kind !== 'ok') return first;

  if (!targetWords) return first;

  const minWords = Math.floor(targetWords * 0.85);
  if (wordCount(first.answer) >= minWords) return first;

  const expansionPrompt = [
    userPrompt,
    `\nCurrent drafted answer (too short at ${wordCount(first.answer)} words):`,
    first.answer,
    `\nRewrite/expand to around ${targetWords} words, still using ONLY the provided evidence.`,
    'Do not add new claims beyond evidence. Keep support_state unchanged unless evidence is insufficient.',
  ].join('\n');

  const second = await callGemini(policy, expansionPrompt);
  if (second.kind !== 'ok') return first;
  if (second.supportState === 'INSUFFICIENT') return first;
  if (!second.usedEvidenceTags.length) return first;
  return second;
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSessionFromRequest(req);
    const profile = await getUserProfile(session.userId);
    await writeStudentProfileSnapshot(session.userId, profile);
    const { query, mode = 'answer', chatHistory = [] } = await req.json();
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Question is required.' }, { status: 400 });
    }

    const userFiles = await listUserFiles(session.userId);
    const allowedIds = new Set(userFiles.map((f) => f.id));
    const fileModuleById = new Map(userFiles.map((f) => [f.id, f.module]));

    const retrieval = await retrieveUserChunks({
      userId: session.userId,
      query,
      k: 8,
      retrievePoolK: 20,
      rerank: true,
      dedup: true,
      metadataFilter: true,
    });

    const scopedResults = (retrieval.results || [])
      .filter((r: any) => {
        const fid = String(r.file_id || '');
        return fid && allowedIds.has(fid);
      })
      .map((r: any) => {
        const fid = String(r.file_id || '');
        const moduleFromFile = fileModuleById.get(fid);
        const rawModule = String(r.module || '').trim();
        const fileModule = String(moduleFromFile || '').trim();
        const isGeneric = (m: string) => !m || m.toLowerCase() === 'general';
        const resolvedModule = !isGeneric(rawModule)
          ? rawModule
          : (!isGeneric(fileModule) ? fileModule : inferSubjectFromFileName(String(r.file || '')));

        return {
          ...r,
          module: resolvedModule,
        };
      });

    const safeHistory: ChatTurn[] = Array.isArray(chatHistory)
      ? chatHistory
          .filter((t: any) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
          .map((t: any) => ({ role: t.role, content: String(t.content) }))
      : [];

    const llm = await groundedLLMAnswer(query, mode === 'summary' ? 'summary' : 'answer', scopedResults, safeHistory);

    if (llm.kind === 'provider_error') {
      console.error('[rag.ask] Gemini provider failure', {
        provider: 'gemini',
        statusCode: llm.statusCode ?? null,
        errorMessage: llm.errorMessage,
        evidenceExists: scopedResults.length > 0,
        evidenceCount: scopedResults.length,
        userId: session.userId,
        mode: mode === 'summary' ? 'summary' : 'answer',
      });
      return NextResponse.json(
        {
          ok: false,
          errorType: 'PROVIDER_UNAVAILABLE',
          message: 'The answer generation service is temporarily unavailable.',
        },
        { status: 503 },
      );
    }

    const isInsufficient = llm.kind === 'insufficient';
    const citations = isInsufficient ? [] : toCitations(scopedResults, query, llm.usedEvidenceTags);

    const record = {
      id: crypto.randomUUID(),
      userId: session.userId,
      query,
      mode: mode === 'summary' ? 'summary' : 'answer',
      answer: isInsufficient
        ? 'Not enough evidence in your uploaded materials to answer this reliably.'
        : llm.answer,
      supportState: isInsufficient ? 'INSUFFICIENT' : llm.supportState,
      citations,
      createdAt: new Date().toISOString(),
    } as const;

    await addQuestion(record);
    await writeRetrievalRecord({
      userId: session.userId,
      queryId: record.id,
      query: record.query,
      mode: record.mode,
      supportState: record.supportState,
      profile,
      retrievedChunks: scopedResults,
    });

    return NextResponse.json({ ok: true, ...record });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Could not generate answer.' }, { status: 500 });
  }
}
