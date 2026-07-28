/* ============================================================
   InstaCaption AI — Application Logic
   ============================================================ */

// ── DOM refs ──────────────────────────────────────────────
const form          = document.getElementById('captionForm');
const generateBtn   = document.getElementById('generateBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const topicTextarea = document.getElementById('topic');
const topicCount    = document.getElementById('topicCount');
const wordSlider    = document.getElementById('wordLimit');
const wordLimitVal  = document.getElementById('wordLimitValue');
const emptyState    = document.getElementById('emptyState');
const results       = document.getElementById('results');
const toast         = document.getElementById('toast');

// ── Slider live update ────────────────────────────────────
wordSlider.addEventListener('input', () => {
  wordLimitVal.textContent = wordSlider.value;
});

// ── Character count ───────────────────────────────────────
topicTextarea.addEventListener('input', () => {
  const len = topicTextarea.value.length;
  topicCount.textContent = `${len} / 500`;
  topicCount.style.color = len > 450 ? '#e91e8c' : 'rgba(240,240,255,0.35)';
});

// ── Form submit ───────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await runGeneration();
});

regenerateBtn.addEventListener('click', async () => {
  await runGeneration();
});

// ── Core generation function ──────────────────────────────
async function runGeneration() {
  const topic    = document.getElementById('topic').value.trim();
  const audience = document.getElementById('audience').value.trim();
  const category = document.getElementById('category').value;
  const style    = document.getElementById('style').value;
  const language = document.getElementById('language').value;
  const maxWords = wordSlider.value;

  // Validation
  if (!topic) { shakeField('topic'); return; }
  if (!category) { shakeField('category'); return; }
  if (!style) { shakeField('style'); return; }

  // Check formats
  const wantCaption  = document.getElementById('fmt-caption').checked;
  const wantCTA      = document.getElementById('fmt-cta').checked;
  const wantHashtags = document.getElementById('fmt-hashtags').checked;
  const wantEmoji    = document.getElementById('fmt-emoji').checked;
  const wantPlain    = document.getElementById('fmt-plain').checked;

  // Show loading state
  setLoading(true);

  try {
    const generated = await generateCaption({
      topic, audience, category, style, language, maxWords,
      wantCaption, wantCTA, wantHashtags, wantEmoji, wantPlain
    });

    displayResults(generated, { category, style, language, maxWords });
  } catch (err) {
    console.error('Generation error:', err);
    // Fallback to local generation
    const generated = generateLocally({
      topic, audience, category, style, language, maxWords,
      wantCaption, wantCTA, wantHashtags, wantEmoji, wantPlain
    });
    displayResults(generated, { category, style, language, maxWords });
  } finally {
    setLoading(false);
  }
}

// ── AI Generation via Gemini API ──────────────────────────
async function generateCaption(params) {
  const { topic, audience, category, style, language, maxWords,
          wantCaption, wantCTA, wantHashtags, wantEmoji, wantPlain } = params;

  const audienceStr = audience ? `Target audience: ${audience}.` : '';
  const formatsNeeded = [
    wantCaption  && 'CAPTION',
    wantCTA      && 'CTA',
    wantHashtags && 'HASHTAGS',
    wantEmoji    && 'EMOJI_VERSION',
    wantPlain    && 'PLAIN_VERSION'
  ].filter(Boolean);

  const prompt = `You are an expert Instagram Content Strategist and Social Media Manager.

Generate Instagram content for the following:

Topic/Event: ${topic}
${audienceStr}
Category: ${category}
Caption Style: ${style}
Language: ${language}
Maximum Words: ${maxWords}

Generate ONLY the requested formats below. Return your response as a valid JSON object with these exact keys (only include keys for formats requested):
${formatsNeeded.includes('CAPTION') ? '- "caption": The main Instagram caption (max ' + maxWords + ' words, engaging, original, no jargon)' : ''}
${formatsNeeded.includes('CTA') ? '- "cta": A compelling call-to-action sentence (1-2 sentences)' : ''}
${formatsNeeded.includes('HASHTAGS') ? '- "hashtags": An array of 5-10 SEO-friendly hashtag strings (include the # symbol)' : ''}
${formatsNeeded.includes('EMOJI_VERSION') ? '- "emoji_version": Full caption with CTA, rich with relevant emojis throughout' : ''}
${formatsNeeded.includes('PLAIN_VERSION') ? '- "plain_version": Full caption with CTA, absolutely no emojis' : ''}

Requirements:
- Style must be: ${style}
- Language: ${language} (simple, clear, and easy to read)
- Relevant to category: ${category}
- Original, SEO-friendly, no plagiarism
- No jargon, engaging and scannable

Respond ONLY with the JSON object. No markdown, no explanation.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyBlfCBJkIiQQzp2i4_yyJqfH0V0mhQgvYY`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          topP: 0.95,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json'
        }
      })
    }
  );

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Invalid JSON response');
  }
}

// ── Local fallback generator ──────────────────────────────
function generateLocally(params) {
  const { topic, audience, category, style, maxWords,
          wantCaption, wantCTA, wantHashtags, wantEmoji, wantPlain } = params;

  const templates = {
    Professional: {
      caption: `In today's rapidly evolving landscape, ${topic} is reshaping the way we think, work, and connect. Staying ahead means embracing innovation and taking strategic action. This is not just a trend — it's a transformation that defines the future of ${category}.`,
      cta: `Ready to elevate your game? Drop a comment below or DM us to learn more.`,
    },
    Creative: {
      caption: `Imagine a world where ${topic} isn't just possible — it's inevitable. We're painting outside the lines, breaking the mold, and building something beautifully different in the ${category} space.`,
      cta: `Tag someone who needs to see this! ✨`,
    },
    Funny: {
      caption: `Me before discovering ${topic}: 😴 Me after: 🚀 Honestly, ${category} hit different when you find the right vibe. No regrets, just gains.`,
      cta: `Drop a 🔥 if this is SO you!`,
    },
    Inspirational: {
      caption: `Every great journey starts with a single step. ${topic} is that step for thousands of people in ${category}. You have the power to be next. Your story isn't over — it's just beginning.`,
      cta: `Share this with someone who needs a spark today. 🌟`,
    },
    Storytelling: {
      caption: `It started with a question: "What if ${topic} could change everything?" Six months later, here we are — proof that ${category} can transform lives when you dare to start.`,
      cta: `Tell us your story in the comments below. 👇`,
    },
    Promotional: {
      caption: `Introducing the future of ${category}: ${topic}. Designed for those who refuse to settle. Trusted by thousands. Built to last. Limited availability — don't wait.`,
      cta: `Tap the link in bio to get yours before it's gone! 🛒`,
    },
    Luxury: {
      caption: `For those who appreciate the extraordinary. ${topic} represents the pinnacle of excellence in ${category} — a rare experience crafted for the discerning few who demand nothing less than the finest.`,
      cta: `Inquire within. Exclusivity awaits. ✉️`,
    },
    Minimal: {
      caption: `${topic}.\n\nThat's it. That's the post.`,
      cta: `Save this. You'll thank us later.`,
    },
    Viral: {
      caption: `Nobody is talking about this, but ${topic} just changed the ${category} game FOREVER. I'm not exaggerating. This is the thing everyone will be talking about in 6 months. First movers win. Always.`,
      cta: `SHARE this before everyone else figures it out! 🔁`,
    },
    Motivational: {
      caption: `Stop waiting for the perfect moment. ${topic} is your sign to START. The ${category} space is full of people who almost made it — don't be one of them. You were built for more than "almost."`,
      cta: `Double-tap if you're ready to level up! 💪`,
    }
  };

  const tpl = templates[params.style] || templates['Professional'];

  const hashtagMap = {
    AI: ['#ArtificialIntelligence','#AITools','#MachineLearning','#TechTrends','#AIRevolution','#FutureOfAI','#DeepLearning','#AIInnovation'],
    Startup: ['#StartupLife','#Entrepreneur','#Startup','#Hustle','#BuildInPublic','#FounderLife','#StartupGrowth','#Innovation'],
    Fitness: ['#FitnessMotivation','#WorkoutLife','#FitLife','#GymLife','#HealthyLiving','#FitnessGoals','#TrainHard','#ActiveLifestyle'],
    Travel: ['#TravelGram','#Wanderlust','#ExploreMore','#TravelPhotography','#Adventure','#TravelBlogger','#ExploreTheWorld','#NatureLovers'],
    Food: ['#FoodPhotography','#Foodie','#FoodBlogger','#InstaFood','#EatWell','#FoodLovers','#FoodGram','#HomeCooking'],
    Fashion: ['#FashionGram','#OOTD','#StyleInspo','#FashionBlogger','#FashionLovers','#Trendy','#StyleFile','#FashionDaily'],
    Technology: ['#Tech','#Technology','#Innovation','#FutureOfTech','#TechNews','#DigitalTransformation','#TechCommunity','#Coding'],
    Marketing: ['#DigitalMarketing','#MarketingStrategy','#ContentMarketing','#SocialMediaMarketing','#GrowthHacking','#MarketingTips','#BrandBuilding','#ContentCreator'],
    Education: ['#Education','#Learning','#Knowledge','#EduTech','#LearnEveryday','#StudyMotivation','#TeachersOfInstagram','#OnlineLearning'],
    Finance: ['#Finance','#Investing','#MoneyMindset','#WealthBuilding','#FinancialFreedom','#PersonalFinance','#Investment','#MoneyTips'],
  };

  const defaultTags = ['#Instagram','#Content','#ViralPost','#Trending','#MustSee','#Instagood','#InstaDaily','#Explore'];
  const tags = hashtagMap[params.category] || defaultTags;
  const selected = tags.slice(0, 8);

  const result = {};

  if (wantCaption) result.caption = tpl.caption;
  if (wantCTA) result.cta = tpl.cta;
  if (wantHashtags) result.hashtags = selected;
  if (wantEmoji) {
    const emojis = ['✨','🔥','💯','🚀','💫','🌟','❤️','👇','🎯','💪'];
    result.emoji_version = `${tpl.caption}\n\n${tpl.cta}\n\n${selected.join(' ')}`;
  }
  if (wantPlain) {
    result.plain_version = `${tpl.caption.replace(/[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F900}-\u{1F9FF}]/gu, '').trim()}\n\n${tpl.cta.replace(/[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F900}-\u{1F9FF}]/gu, '').trim()}`;
  }

  return result;
}

// ── Display Results ───────────────────────────────────────
function displayResults(data, meta) {
  // Meta pills
  const metaEl = document.getElementById('resultsMeta');
  metaEl.innerHTML = `
    <span class="meta-pill accent">${meta.category}</span>
    <span class="meta-pill accent">${meta.style}</span>
    <span class="meta-pill">${meta.language}</span>
    <span class="meta-pill">Max ${meta.maxWords} words</span>
  `;

  // Caption
  const captionCard = document.getElementById('captionCard');
  if (data.caption) {
    document.getElementById('captionContent').textContent = data.caption;
    captionCard.style.display = 'block';
  } else {
    captionCard.style.display = 'none';
  }

  // CTA
  const ctaCard = document.getElementById('ctaCard');
  if (data.cta) {
    document.getElementById('ctaContent').textContent = data.cta;
    ctaCard.style.display = 'block';
  } else {
    ctaCard.style.display = 'none';
  }

  // Hashtags
  const hashtagsCard = document.getElementById('hashtagsCard');
  if (data.hashtags && data.hashtags.length) {
    const hashEl = document.getElementById('hashtagsContent');
    hashEl.innerHTML = '';
    (Array.isArray(data.hashtags) ? data.hashtags : data.hashtags.split(' ')).forEach(tag => {
      const pill = document.createElement('span');
      pill.className = 'hashtag-tag';
      pill.textContent = tag.startsWith('#') ? tag : `#${tag}`;
      pill.addEventListener('click', () => {
        copyText(pill.textContent);
        showToast(`${pill.textContent} copied!`);
      });
      hashEl.appendChild(pill);
    });
    hashtagsCard.style.display = 'block';
  } else {
    hashtagsCard.style.display = 'none';
  }

  // Emoji version
  const emojiCard = document.getElementById('emojiCard');
  if (data.emoji_version) {
    document.getElementById('emojiContent').textContent = data.emoji_version;
    emojiCard.style.display = 'block';
  } else {
    emojiCard.style.display = 'none';
  }

  // Plain version
  const plainCard = document.getElementById('plainCard');
  if (data.plain_version) {
    document.getElementById('plainContent').textContent = data.plain_version;
    plainCard.style.display = 'block';
  } else {
    plainCard.style.display = 'none';
  }

  // Show results panel
  emptyState.style.display = 'none';
  results.style.display = 'block';

  // Scroll to results on mobile
  if (window.innerWidth < 960) {
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ── Copy functions ────────────────────────────────────────
function copyContent(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  let text = '';
  if (elementId === 'hashtagsContent') {
    text = Array.from(el.querySelectorAll('.hashtag-tag'))
      .map(t => t.textContent)
      .join(' ');
  } else {
    text = el.textContent;
  }

  copyText(text);
  showToast('Copied to clipboard!');
}

function copyAll() {
  const parts = [];

  const caption = document.getElementById('captionContent');
  if (caption && caption.closest('.output-card').style.display !== 'none') {
    parts.push(`📝 CAPTION:\n${caption.textContent}`);
  }

  const cta = document.getElementById('ctaContent');
  if (cta && cta.closest('.output-card').style.display !== 'none') {
    parts.push(`📣 CALL TO ACTION:\n${cta.textContent}`);
  }

  const hashtags = document.getElementById('hashtagsContent');
  if (hashtags && hashtags.closest('.output-card').style.display !== 'none') {
    const tags = Array.from(hashtags.querySelectorAll('.hashtag-tag')).map(t => t.textContent).join(' ');
    parts.push(`#️⃣ HASHTAGS:\n${tags}`);
  }

  const emoji = document.getElementById('emojiContent');
  if (emoji && emoji.closest('.output-card').style.display !== 'none') {
    parts.push(`😊 EMOJI VERSION:\n${emoji.textContent}`);
  }

  const plain = document.getElementById('plainContent');
  if (plain && plain.closest('.output-card').style.display !== 'none') {
    parts.push(`📄 PLAIN VERSION:\n${plain.textContent}`);
  }

  copyText(parts.join('\n\n─────────────────\n\n'));
  showToast('All content copied!');
}

function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

// ── Toast ─────────────────────────────────────────────────
let toastTimeout;
function showToast(message = 'Copied to clipboard!') {
  clearTimeout(toastTimeout);
  toast.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> ${message}`;
  toast.classList.add('show');
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── Loading state ─────────────────────────────────────────
function setLoading(loading) {
  const btnText   = generateBtn.querySelector('.btn-text');
  const btnLoader = generateBtn.querySelector('.btn-loader');

  if (loading) {
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    generateBtn.disabled = true;
    regenerateBtn.disabled = true;
  } else {
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    generateBtn.disabled = false;
    regenerateBtn.disabled = false;
  }
}

// ── Field shake animation ─────────────────────────────────
function shakeField(fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'shake 0.4s ease';
  el.focus();

  // Inject shake keyframe if not present
  if (!document.getElementById('shakeStyle')) {
    const style = document.createElement('style');
    style.id = 'shakeStyle';
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-6px); }
        40% { transform: translateX(6px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(4px); }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => { el.style.animation = ''; }, 450);
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  wordLimitVal.textContent = wordSlider.value;
});
