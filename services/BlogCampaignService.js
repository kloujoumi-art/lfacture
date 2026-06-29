const Post = require('../models/Post');
const BlogCampaign = require('../models/BlogCampaign');

const FREQ_MS = {
  daily:       24 * 60 * 60 * 1000,
  four_daily:  6  * 60 * 60 * 1000,
  six_daily:   4  * 60 * 60 * 1000,
  eight_daily: 3  * 60 * 60 * 1000,
  ten_daily:   2  * 60 * 60 * 1000 + 24 * 60 * 1000,
};

async function fetchImageFal(keyword, language) {
  const FAL_KEY = process.env.FAL_API_KEY;
  if (!FAL_KEY) throw new Error('FAL_API_KEY manquant');

  const langHint = language === 'ar' ? 'Arabic style, ' : language === 'en' ? '' : 'French professional, ';
  const prompt = `${langHint}professional blog cover image about "${keyword}", invoicing software, modern clean minimalist flat design, business, blue and purple tones, no text, high quality`;

  const resp = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${FAL_KEY}`,
    },
    body: JSON.stringify({
      prompt,
      image_size: 'landscape_4_3',
      num_inference_steps: 4,
      num_images: 1,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error(`FAL AI ${resp.status}: ${err.slice(0, 150)}`);
  }

  const data = await resp.json();
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('FAL AI: aucune image retournée');
  return url;
}

async function fetchImagePexels(keyword) {
  const PEXELS_KEY = process.env.PEXELS_API_KEY;
  if (!PEXELS_KEY) return null;

  const query = encodeURIComponent(keyword.split(' ').slice(0, 3).join(' '));
  const resp = await fetch(`https://api.pexels.com/v1/search?query=${query}&per_page=3&orientation=landscape`, {
    headers: { Authorization: PEXELS_KEY },
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  return data.photos?.[0]?.src?.large2x || data.photos?.[0]?.src?.large || null;
}

async function fetchCoverImage(keyword, image_source, language) {
  try {
    if (image_source === 'fal') return await fetchImageFal(keyword, language);
    return await fetchImagePexels(keyword);
  } catch (e) {
    console.warn(`[BlogCampaign] Image fetch failed (${image_source}): ${e.message}`);
    return null;
  }
}

async function generateArticle({ keyword, language = 'fr' }) {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY manquant dans les variables d\'environnement');

  const langMap = { fr: 'français', en: 'anglais', ar: 'arabe' };
  const lang = langMap[language] || 'français';

  const systemPrompt = `Tu es un expert en comptabilité, facturation et gestion d'entreprise. Tu écris des articles de blog SEO optimisés pour LFacture, un logiciel de facturation en ligne pour TPE/PME. Tes articles sont professionnels, concrets et bien structurés en HTML propre.`;

  const userPrompt = `Écris un article de blog complet en ${lang} sur le sujet : "${keyword}".

Cible : propriétaires de TPE/PME, artisans, freelances, commerçants qui cherchent à mieux gérer leur facturation.

Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown, pas de balises \`\`\`) dans ce format exact :
{
  "title": "Titre SEO accrocheur (50-65 caractères)",
  "excerpt": "Description courte 1-2 phrases pour la meta description (max 155 caractères)",
  "tags": "tag1,tag2,tag3,tag4",
  "content": "<article HTML avec h2, h3, p, ul, li — minimum 600 mots, style professionnel>"
}`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`OpenAI API ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  const text = (data.choices?.[0]?.message?.content || '').trim();

  let article;
  try {
    article = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]+\}/);
    if (match) {
      try { article = JSON.parse(match[0]); }
      catch { throw new Error('Format JSON invalide dans la réponse OpenAI'); }
    } else {
      throw new Error('Aucun JSON trouvé dans la réponse OpenAI');
    }
  }

  if (!article.title || !article.content) throw new Error('Réponse OpenAI incomplète (title ou content manquant)');
  return article;
}

async function runCampaign(campaign) {
  const keywords = campaign.keywords;
  if (!keywords || !keywords.length) throw new Error('Aucun keyword configuré');

  const keyword = keywords[campaign.keyword_index % keywords.length];
  const image_source = campaign.image_source || 'pexels';

  // Génération article + image en parallèle
  const [article, coverImage] = await Promise.all([
    generateArticle({ keyword, language: campaign.language }),
    fetchCoverImage(keyword, image_source, campaign.language),
  ]);

  const post = Post.create({
    title: article.title,
    excerpt: article.excerpt || '',
    content: article.content,
    tags: article.tags || keyword,
    meta_desc: article.excerpt || '',
    cover_image: coverImage || '',
    source: 'campaign',
    published: true,
  });

  const nextKeywordIndex = (campaign.keyword_index + 1) % keywords.length;
  const freqMs = FREQ_MS[campaign.frequency] || FREQ_MS.daily;

  BlogCampaign.update(campaign.id, {
    run_count: (campaign.run_count || 0) + 1,
    success_count: (campaign.success_count || 0) + 1,
    keyword_index: nextKeywordIndex,
    last_run_at: new Date().toISOString(),
    last_error: null,
    next_run_at: new Date(Date.now() + freqMs).toISOString(),
  });

  console.log(`[BlogCampaign] ✅ "${post.title}" | image: ${image_source} | keyword: ${keyword}`);
  return { post, keyword };
}

async function runDueCampaigns() {
  const due = BlogCampaign.findDue();
  if (!due.length) return [];

  console.log(`[BlogCampaign] ${due.length} campagne(s) à exécuter`);
  const results = [];

  for (const campaign of due) {
    try {
      const result = await runCampaign(campaign);
      results.push({ id: campaign.id, name: campaign.name, ok: true, keyword: result.keyword });
    } catch (e) {
      console.error(`[BlogCampaign] ❌ Campagne "${campaign.name}" : ${e.message}`);
      const freqMs = FREQ_MS[campaign.frequency] || FREQ_MS.daily;
      BlogCampaign.update(campaign.id, {
        run_count: (campaign.run_count || 0) + 1,
        last_run_at: new Date().toISOString(),
        last_error: e.message,
        next_run_at: new Date(Date.now() + freqMs).toISOString(),
      });
      results.push({ id: campaign.id, name: campaign.name, ok: false, error: e.message });
    }
  }

  return results;
}

function startCampaignScheduler() {
  const INTERVAL = 30 * 60 * 1000;
  setInterval(() => {
    runDueCampaigns().catch(e => console.error('[BlogCampaign scheduler]', e.message));
  }, INTERVAL);
  console.log('[BlogCampaign] Scheduler démarré (vérification toutes les 30 min)');
}

module.exports = { generateArticle, runCampaign, runDueCampaigns, startCampaignScheduler };
