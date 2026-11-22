(() => {
  const T = window.SHADE_I18N || {};
  const t = (k) => T[k] ?? k;
  const form = document.getElementById('brief');
  const result = document.getElementById('result');
  const loading = document.getElementById('loading');
  const errorBox = document.getElementById('form-error');
  const button = form.querySelector('button');
  const DRAFT_KEY = 'shade:draft';

  // Rozpísané zadanie si pamätáme v prehliadači (len pre pohodlie).
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (draft) for (const [k, v] of Object.entries(draft)) if (form.elements[k] && k !== 'output_lang') form.elements[k].value = v;
  } catch {}
  form.addEventListener('input', () => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(Object.fromEntries(new FormData(form)))); } catch {}
  });

  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c != null) node.append(c);
    return node;
  };
  const channelName = (c) => t('channel.' + c);
  const section = (title, ...body) => el('section', { class: 'card block' }, el('h2', {}, title), ...body);

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  function render(plan, mode) {
    const p = plan.positioning;
    result.replaceChildren(
      mode === 'demo' ? el('p', { class: 'notice' }, t('result.demo')) : null,

      section(t('result.positioning'),
        el('p', { class: 'one-liner' }, p.one_liner),
        el('ul', {}, p.value_props.map((v) => el('li', {}, v))),
        el('p', { class: 'muted' }, el('strong', {}, t('result.tone') + ': '), p.tone)),

      section(t('result.audiences'), el('div', { class: 'grid' }, plan.audiences.map((a) =>
        el('div', { class: 'mini' },
          el('h3', {}, a.name),
          el('p', {}, a.description),
          el('p', { class: 'muted' }, el('strong', {}, t('result.where') + ': '), a.where_to_find.map((w) => T['channel.' + w] ?? w).join(', ')))))),

      section(t('result.channels'), el('div', { class: 'grid' }, plan.channels.map((c) =>
        el('div', { class: 'mini' },
          el('h3', {}, channelName(c.channel), ' ', el('span', { class: 'badge ' + c.priority }, t('priority.' + c.priority))),
          el('p', {}, c.why),
          el('p', { class: 'muted' }, el('strong', {}, t('result.first_step') + ': '), c.first_step))))),

      section(t('result.plan'), el('ol', { class: 'weeks' }, plan.plan.map((w) =>
        el('li', {},
          el('h3', {}, `${t('result.week')} ${w.week}: ${w.focus}`),
          el('ul', { class: 'checks' }, w.tasks.map((task) => el('li', {}, el('label', {}, el('input', { type: 'checkbox' }), ' ', task)))))))),

      section(t('result.ideas'), el('ul', { class: 'ideas' }, plan.content_ideas.map((i) =>
        el('li', {}, el('strong', {}, i.title), el('span', { class: 'muted' }, ` · ${i.format} · ${channelName(i.channel)}`))))),

      section(t('result.posts'), plan.posts.map((post) => {
        const copy = el('button', { type: 'button', class: 'ghost' }, t('result.copy'));
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(post.text); copy.textContent = t('result.copied'); } catch {}
        });
        return el('div', { class: 'post' },
          el('div', { class: 'post-head' }, el('h3', {}, channelName(post.channel)), copy),
          el('pre', {}, post.text));
      })),

      section(t('result.quick_wins'), el('ul', { class: 'checks' }, plan.quick_wins.map((q) =>
        el('li', {}, el('label', {}, el('input', { type: 'checkbox' }), ' ', q))))),

      el('div', { class: 'actions' },
        el('button', { type: 'button', onclick: () => window.print() }, t('result.print')),
        el('button', { type: 'button', class: 'ghost', onclick: () => form.scrollIntoView({ behavior: 'smooth' }) }, t('result.again'))),
    );
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const data = Object.fromEntries(new FormData(form));

    if (!data.name.trim()) return showError(t('error.name'));
    if (data.description.trim().length < 20) return showError(t('error.description'));

    button.disabled = true;
    loading.hidden = false;
    try {
      const res = await fetch('/api/generate.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.plan) return render(body.plan, body.mode);
      if (body.error === 'validation') return showError(t('error.' + body.fields[0]));
      showError(body.error === 'refused' ? t('error.refused') : t('error.generic'));
    } catch {
      showError(t('error.generic'));
    } finally {
      button.disabled = false;
      loading.hidden = true;
    }
  });
})();
