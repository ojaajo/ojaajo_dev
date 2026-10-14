// New home: read-only; legacy app and database writes are unchanged.
(function () {
  'use strict';
  const builtIns = [
    ['beginner', '初級', 'beginnerWords'],
    ['intermediate', '中級', 'intermediateWords'],
    ['advanced', '上級', 'advancedWords'],
    ['expressionup', '表現力UP', 'expressionUpWords']
  ];
  const status = document.getElementById('modern-home-status');
  const overview = document.getElementById('modern-home-overview');
  const target = document.getElementById('modern-home-lists');
  if (!status || !target || !overview) return;
  let requestId = 0;
  function tile(name, total, learned) {
    const card = document.createElement('div');
    card.className = 'modern-list-tile';
    const content = document.createElement('div');
    content.style.flex = '1';
    const title = document.createElement('strong');
    title.textContent = name;
    const detail = document.createElement('small');
    detail.textContent = total + '語 ・ 暗記済み ' + learned + '語';
    const track = document.createElement('div');
    track.className = 'modern-list-track';
    const fill = document.createElement('span');
    const percent = total ? Math.round(learned / total * 100) : 0;
    fill.style.width = percent + '%';
    track.appendChild(fill);
    content.append(title, detail, track);
    const rate = document.createElement('span');
    rate.className = 'modern-list-rate';
    rate.textContent = percent + '%';
    card.append(content, rate);
    return card;
  }
  async function refreshHome() {
    const id = ++requestId;
    status.textContent = '単語リストを読み込んでいます…';
    try {
      if (typeof supabaseClient === 'undefined') throw new Error('Supabaseに接続できません。');
      const { data: auth, error: authError } = await supabaseClient.auth.getUser();
      if (authError) throw authError;
      if (id !== requestId) return;
      const user = auth && auth.user;
      if (!user) {
        target.replaceChildren();
        status.textContent = 'クラウドにログインすると、単語リストと暗記状況を表示できます。右下の☁️からログインしてください。';
        overview.textContent = 'ログイン待ち';
        return;
      }
      const [listsResult, wordsResult, progressResult] = await Promise.all([
        supabaseClient.from('vocab_lists').select('list_key, name').eq('user_id', user.id),
        supabaseClient.from('vocab_words').select('list_key, word').eq('user_id', user.id),
        supabaseClient.from('word_progress').select('list_key, word, status').eq('user_id', user.id)
      ]);
      if (id !== requestId) return;
      for (const result of [listsResult, wordsResult, progressResult]) {
        if (result.error) throw result.error;
      }
      const lists = builtIns.map(([key, name, variable]) => ({
        key, name, words: Array.isArray(window[variable]) ? window[variable] : (typeof WORD_MAP !== 'undefined' ? WORD_MAP[key] || [] : [])
      }));
      const custom = listsResult.data || [];
      for (const item of custom) {
        lists.push({
          key: item.list_key, name: item.name,
          words: (wordsResult.data || []).filter(w => w.list_key === item.list_key)
        });
      }
      const progress = new Map();
      for (const row of progressResult.data || []) {
        if (row.status === '暗記済') {
          if (!progress.has(row.list_key)) progress.set(row.list_key, new Set());
          progress.get(row.list_key).add(row.word);
        }
      }
      const fragment = document.createDocumentFragment();
      let totalWords = 0, totalLearned = 0;
      for (const list of lists) {
        const words = new Set(list.words.map(w => w.word));
        const learned = [...(progress.get(list.key) || [])].filter(w => words.has(w)).length;
        totalWords += words.size;
        totalLearned += learned;
        fragment.appendChild(tile(list.name, words.size, learned));
      }
      target.replaceChildren(fragment);
      status.textContent = lists.length + '件の単語リスト';
      overview.textContent = totalWords + '語のうち ' + totalLearned + '語を暗記済み';
    } catch (error) {
      if (id !== requestId) return;
      console.error('新ホームの読み込みエラー:', error);
      status.textContent = 'データを読み込めませんでした。ログイン状態や通信を確認してください。';
      overview.textContent = '読み込みエラー';
    }
  }
  window.addEventListener('study-screen-changed', e => {
    if (e.detail && e.detail.screen === 'home') refreshHome();
  });
  window.addEventListener('word-progress-changed', () => {
    if (!document.querySelector('#modern-workspace [data-screen="home"]')?.hidden) refreshHome();
  });
  if (typeof supabaseClient !== 'undefined') {
    supabaseClient.auth.onAuthStateChange(() => setTimeout(() => {
      if (!document.querySelector('#modern-workspace [data-screen="home"]')?.hidden) refreshHome();
    }, 0));
  }
})();
