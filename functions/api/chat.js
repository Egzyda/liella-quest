// Cloudflare Pages Functions: /api/chat（クラウドAI）
// 設定：Pages プロジェクト > 設定 > バインディング > Workers AI を追加（変数名: AI）
// 無料プランなら料金はかからない。1日の無料枠を超えるとエラーになるだけ（ゲームは AI なしで続く）。
//
// 2種類のAIを使い分けて無料枠を節約する：
//   light … セリフの言い回し（回数が多い）。安いモデル。環境変数 AI_MODEL_LIGHT で変更できる
//   main  … 自由入力の読み取り・投票の判断（回数が少ない）。環境変数 AI_MODEL で変更できる

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DEFAULT_LIGHT = '@cf/google/gemma-4-26b-a4b-it';
const modelFor = (env, tier) => (tier === 'light' ? env.AI_MODEL_LIGHT || DEFAULT_LIGHT : env.AI_MODEL || DEFAULT_MODEL);

export async function onRequestGet({ env }) {
  return Response.json({ ai: !!env.AI, model: modelFor(env, 'main'), light: modelFor(env, 'light') });
}

function textOf(r) {
  let t = r?.response ?? r?.choices?.[0]?.message?.content ?? r?.result?.response ?? '';
  if (typeof t !== 'string') t = JSON.stringify(t);
  return t.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}
const isQuota = msg => /4006|neuron|allocation|quota|rate limit|limit exceeded/i.test(msg);

export async function onRequestPost({ request, env }) {
  if (!env.AI) return Response.json({ error: 'AI binding not configured' }, { status: 501 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'bad json' }, { status: 400 }); }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-6).map(m => ({ role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 6000) })) : [];
  if (!messages.length) return Response.json({ error: 'no messages' }, { status: 400 });
  const max_tokens = Math.min(Number(body.max_tokens) || 120, 400);
  const temperature = Math.min(Math.max(Number(body.temperature) || 0.7, 0), 1.2);
  const tier = body.tier === 'light' ? 'light' : 'main';
  const run = async model => {
    const r = await env.AI.run(model, { messages, max_tokens, temperature });
    return Response.json({ text: textOf(r), usage: r?.usage || null, model });
  };
  try {
    return await run(modelFor(env, tier));
  } catch (e) {
    const msg = String(e);
    if (isQuota(msg)) return Response.json({ error: msg, quota: true }, { status: 429 });
    // 片方のモデルが使えなかったら、もう片方で答える
    try { return await run(modelFor(env, tier === 'light' ? 'main' : 'light')); } catch (e2) {
      const m2 = String(e2);
      return Response.json({ error: m2, quota: isQuota(m2) }, { status: isQuota(m2) ? 429 : 500 });
    }
  }
}
