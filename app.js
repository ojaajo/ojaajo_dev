// ---------------------- 基本状態 ----------------------
let completed = false;
let selectedList = []; // ← 初期選択は後でDOM読み込み後に決める

// 単語配列マップ（存在する配列名に合わせてここだけ整備）
const WORD_MAP = {
  beginner:      beginnerWords,
  intermediate:  intermediateWords,
  advanced:      advancedWords,
  expressionup:  expressionUpWords,
  Level4:        Level4ofkoreanschool,
  Level5:        Level5ofkoreanschool,
};
// 自作リストの名前を管理
const CUSTOM_LIST_NAMES = {};
// 出題用：現在の selectedList から範囲抽出
function getWordsInRange(start, end, onlyIncorrect) {
  return selectedList.filter(w =>
    w.page >= start && w.page <= end &&
    (!onlyIncorrect || w.status === "未暗記")
  );
}
// Supabaseの自作リストから単語を読み込む
async function loadCustomWordList(listKey) {
  const { data: { user }, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError) throw userError;
  if (!user) {
    throw new Error("Supabaseにログインしてください。");
  }

  const { data: words, error } = await supabaseClient
    .from("vocab_words")
    .select("word, meaning, page, example")
    .eq("user_id", user.id)
    .eq("list_key", listKey)
    .order("page")
    .order("word");

  if (error) throw error;

  selectedList = (words || []).map(item => ({
    word: item.word,
    meaning: item.meaning,
    page: Number(item.page) || 1,
    example: item.example,
  }));

  const tableContainer = document.getElementById("scrollable-table");
  if (tableContainer) {
    tableContainer.classList.remove("small-text-mode");
  }

  return selectedList;
}
// ---------------------- レベル選択とリスト決定 ----------------------
function setWordList(listType) {
  // 安全に現在のレベル配列を取得
  const base = WORD_MAP[listType] || [];
  // 直接書き換え防止のためコピー
  selectedList = base.map(w => ({ ...w }));

  // 表現力UPだけフォント小さめ
  const tableContainer = document.getElementById('scrollable-table');
  if (tableContainer) {
    tableContainer.classList.toggle('small-text-mode', listType === 'expressionup');
  }

  // （単語一覧やクイズ開始の時点でこの selectedList が使われます）
}

// ---------------------- ページセレクトの生成 ----------------------
function maxPageOf(list) {
  return list.reduce((m, w) => Math.max(m, Number(w.page) || 1), 1);
}

// あるレベルの最大ページ数から、指定の select を 1..max で作り直す
function rebuildSelectOptions(selectId, max) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (let p = 1; p <= max; p++) {
    const opt = document.createElement('option');
    opt.value = String(p);
    opt.textContent = String(p);
    frag.appendChild(opt);
  }
  sel.appendChild(frag);
}

// 左右リンク：左を変えたら右の候補を“左以上のみ”に再構築し、値も同期
function linkStartEnd(startId, endId) {
  const s = document.getElementById(startId);
  const e = document.getElementById(endId);
  if (!s || !e) return;

  // すでにリンク済みなら、右候補の更新だけして終了
  if (s._linkedTo === endId && e._linkedFrom === startId) {
    // 最新の全候補を撮り直し
    e._allOptions = Array.from(e.options).map(o => o.cloneNode(true));
    // 左以上に絞って値も揃える
    const startVal = parseInt(s.value, 10);
    e.innerHTML = '';
    const frag = document.createDocumentFragment();
    e._allOptions.forEach(opt => {
      const v = parseInt(opt.value, 10);
      if (isNaN(v) || v >= startVal) frag.appendChild(opt.cloneNode(true));
    });
    e.appendChild(frag);
    if (parseInt(e.value, 10) < startVal) e.value = String(startVal);
    return;
  }

  // 初回リンク
  s._linkedTo = endId;
  e._linkedFrom = startId;

  // 右の全<option>スナップショット
  e._allOptions = Array.from(e.options).map(o => o.cloneNode(true));

  const rebuildRight = () => {
    const startVal = parseInt(s.value, 10);
    if (isNaN(startVal)) return;
    e.innerHTML = '';
    const frag = document.createDocumentFragment();
    e._allOptions.forEach(opt => {
      const v = parseInt(opt.value, 10);
      if (isNaN(v) || v >= startVal) frag.appendChild(opt.cloneNode(true));
    });
    e.appendChild(frag);
    const endVal = parseInt(e.value, 10);
    if (isNaN(endVal) || endVal < startVal) e.value = String(startVal);
  };

  s.addEventListener('change', () => {
    if (document.activeElement === e) return; // 右を開いている最中は閉じさせない
    rebuildRight();
  });

  // 初期同期
  rebuildRight();
}

// レベルセレクタの値から、そのペア（開始/終了）を作り直す
function populatePageSelectorsFor(levelSelectId, startId, endId) {
  const lvSel = document.getElementById(levelSelectId);
  if (!lvSel) return;
  const level = lvSel.value;
  const list = WORD_MAP[level] || [];
  const max = maxPageOf(list);

  rebuildSelectOptions(startId, max);
  rebuildSelectOptions(endId,   max);

  // 左右リンク（左以上のみ表示＋値同期）
  linkStartEnd(startId, endId);
}

// ---------------------- 起動時セットアップ ----------------------
document.addEventListener('DOMContentLoaded', () => {
  // それぞれのレベルセレクトでページ選択肢を生成
  populatePageSelectorsFor('wordlist-level-select', 'wordlist-start-page', 'wordlist-end-page');
  populatePageSelectorsFor('quiz-level-select',     'start-page',           'end-page');

  // レベル変更時にページ選択肢を作り直す（級ごとの最大ページ数に合わせる）
  const wlLevel = document.getElementById('wordlist-level-select');
  // リスト変更時の処理
  wlLevel && wlLevel.addEventListener('change', async () => {
    const level = wlLevel.value;

    try {
      if (level.startsWith('custom:')) {
        // 自作リストをSupabaseから読み込む
        await loadCustomWordList(level.slice('custom:'.length));

        // 読み込んだ単語に合わせてページ選択肢を作る
        const max = maxPageOf(selectedList);
        rebuildSelectOptions('wordlist-start-page', max);
        rebuildSelectOptions('wordlist-end-page', max);
        linkStartEnd('wordlist-start-page', 'wordlist-end-page');
      } else {
        // 通常のリスト
        populatePageSelectorsFor(
          'wordlist-level-select',
          'wordlist-start-page',
          'wordlist-end-page'
        );
        setWordList(level);
      }
    } catch (error) {
      console.error('単語リストの読み込みに失敗しました:', error);
      alert('単語リストの読み込みに失敗しました。ログイン状態や通信を確認してください。');
    }
  });

  const qLevel = document.getElementById('quiz-level-select');
  qLevel && qLevel.addEventListener('change', () => {
    populatePageSelectorsFor('quiz-level-select', 'start-page', 'end-page');
    // クイズ用にも selectedList をこのタイミングで切り替えたいなら↓を有効化
    // setWordList(qLevel.value);
  });

  // 初期 selectedList（単語一覧の方のレベルに合わせる）
  if (wlLevel) setWordList(wlLevel.value);
});


        // 出題範囲に基づく単語リストを取得
function getWordsInRange(start, end, onlyIncorrect) {
    return selectedList.filter(word => word.page >= start && word.page <= end && (!onlyIncorrect || word.status === "未暗記"));
}

// クイズ進行状態のフラグを追加
let isQuizInProgress = false;

function showQuizModal(message, onConfirm, onCancel) {
    const modal = document.getElementById("quiz-modal");
    const modalMessage = document.getElementById("modal-message");
    const yesButton = document.getElementById("modal-yes");
    const noButton = document.getElementById("modal-no");

    modalMessage.textContent = message;
    modal.classList.remove("hidden");

    // 「再開」ボタンのクリックイベント
    yesButton.onclick = () => {
        modal.classList.add("hidden");
        onConfirm();
    };

    // 「新しいクイズを開始」ボタンのクリックイベント
    noButton.onclick = () => {
        modal.classList.add("hidden");
        onCancel();
    };
}

function startQuiz() {
    const startPage = parseInt(document.getElementById("start-page").value);
    const endPage = parseInt(document.getElementById("end-page").value);
    const onlyIncorrect = document.getElementById("only-incorrect").checked;
    const isBeginner = document.getElementById("quiz-level-select").value === "beginner"; // 初級選択ボタンがチェックされているか確認

	const selectedLevel = document.getElementById("quiz-level-select").value;
	setWordList(selectedLevel);

    if (startPage > endPage) {
        alert("開始ページは終了ページ以下にしてください。");
        return;
    }

    // クイズ進行状況を復元するか、新しく開始するか確認
    const savedQuizState = localStorage.getItem("quizProgress");
    if (completed) {
    // 終了フラグが立っている場合は、確認せずに強制的に新しいクイズを開始
    startNewQuiz();
    } else if (savedQuizState) {
        showQuizModal(
            "前回途中で終了したクイズがあります。再開しますか？",
            () => {
                // 再開処理
                loadQuizProgress();
                isQuizInProgress = true;
                showQuizSection();
                nextQuestion();
            },
            () => {
                // 新しいクイズを開始
                startNewQuiz();
            }
        );
    } else {
        // 新しいクイズを開始
        startNewQuiz();
    }
}
// 新しいクイズを開始する関数
function startNewQuiz() {
    completed = false; // 終了フラグをリセット
    const startPage = parseInt(document.getElementById("start-page").value);
    const endPage = parseInt(document.getElementById("end-page").value);
    const onlyIncorrect = document.getElementById("only-incorrect").checked;
    const isBeginner = document.getElementById("quiz-level-select").value === "beginner"; // 初級選択ボタンがチェックされているか確認
    
    loadAnswersFromStorage();
    quizWords = getWordsInRange(startPage, endPage, onlyIncorrect);

    if (quizWords.length === 0) {
        alert("選択範囲内に単語がありません。");
        return;
    }

    quizWords = shuffleArray(quizWords);
    currentQuizIndex = 0;
    isQuizInProgress = true;

    // 進行状況を初期化
    updateProgress();

    showQuizSection();
    nextQuestion();
}
	function shuffleArray(array) {
    	    for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1)); // ランダムなインデックスを生成
                [array[i], array[j]] = [array[j], array[i]]; // 要素を交換
    	    }
    	return array;
	}

        let quizWords = [];
        let currentQuizIndex = 0;

function endQuiz() {
    alert("クイズが終了しました！");

    // クイズ進行状態をリセット
    isQuizInProgress = false;
    quizWords = [];
    currentQuizIndex = 0;

    // ローカルストレージから進行状況を削除
    localStorage.removeItem("quizProgress");

    // クイズセクションを非表示にして範囲選択画面に戻る
    showRangeSelection();
}

// 回答結果を保存
function saveAnswer(word, status) {
    let storedAnswers = JSON.parse(localStorage.getItem('quizAnswers')) || [];
    const existingAnswerIndex = storedAnswers.findIndex(a => a.word === word.word);
    if (existingAnswerIndex >= 0) {
        storedAnswers[existingAnswerIndex].status = status;
    } else {
        storedAnswers.push({ word: word.word, status: status });
    }
    localStorage.setItem('quizAnswers', JSON.stringify(storedAnswers));
}

// ローカルストレージから解答データを復元し、words配列に反映
function loadAnswersFromStorage() {
    const storedAnswers = JSON.parse(localStorage.getItem('quizAnswers')) || [];
    selectedList.forEach(word => {
        const storedAnswer = storedAnswers.find(a => a.word === word.word);
        if (storedAnswer) {
            word.status = storedAnswer.status; // 正解、不正解、未回答の状態を適用
        }
    });
}

// 自動読み上げ機能の状態をトグルする関数
function toggleAutoSpeak() {
    return document.getElementById("auto-speak").checked;
}
function markAnswer(isCorrect) {
    const word = quizWords[currentQuizIndex]; // 現在の単語
    const resultElement = document.getElementById("result");

    // 意味を表示する
    document.getElementById('meaning').style.display = 'inline';

    // 「次へ」ボタンを表示する
    document.getElementById('next-btn').style.display = 'block';
    // 〇×ボタンを非表示
    document.getElementById('incorrect-btn').style.display = "none";
    document.getElementById('correct-btn').style.display = "none";

    // 正解・不正解の判定処理
    if (isCorrect) {
        resultElement.style.color = "green";
        word.status = "暗記済"; 
    } else {
        resultElement.style.color = "red";
        word.status = "未暗記"; 
    }
    // **ここで currentQuizIndex を更新**
    currentQuizIndex++; // 次の問題へ進む

    saveAnswer(word, word.status); // ステータスを保存

    // 進行状況の更新
    updateProgress();

    // 1秒後に次の問題へ移動する処理をセット（〇ボタンが押された場合は自動で移動）
    if (isCorrect) {
        autoNextTimeout = setTimeout(() => {
            nextQuestion(); // ここを showNextWord() ではなく nextQuestion() にする
        }, 1000);
    }
}
// 一つ前の問題に移動
function moveToPrevious() {
    if (currentQuizIndex > 0) {
        currentQuizIndex--;
        nextQuestion();  // 次の問題に進む処理を呼び出す
    }
}

// 一つ次の問題に移動
function moveToNext() {
    if (currentQuizIndex < quizWords.length - 1) {
        currentQuizIndex++;
        nextQuestion();  // 次の問題に進む処理を呼び出す
    }
}

let currentWord = 0; // フラッシュカードの現在の単語インデックスを初期化
let autoNextTimeout;  // 1秒後の自動移動処理を管理する変数

// 次の問題に進む
function nextQuestion() {
    clearTimeout(autoNextTimeout);  // 1秒後の自動移動をキャンセル

    // クイズが終了した場合、最後の問題の処理を行う
    if (currentQuizIndex >= quizWords.length) {
        alert("フラッシュカード終了！");
        completed = true;  // 終了状態を示すフラグを立てる
        showRangeSelection(); // 範囲選択画面に戻る
        return;
    }

    speechSynthesis.cancel();
    if (speechTimeoutId) {
        clearTimeout(speechTimeoutId);
        speechTimeoutId = null;
    }

    // 現在の単語を設定
    const word = quizWords[currentQuizIndex]; 
    document.getElementById("word").innerHTML = word.word;
    document.getElementById("meaning").innerHTML = word.meaning;
    document.getElementById('meaning').style.display = "none"; 
    document.getElementById("result").innerHTML = "";

    // 「〇×」ボタンを表示
    document.getElementById("incorrect-btn").style.display = "inline-block";
    document.getElementById("correct-btn").style.display = "inline-block";
    document.getElementById("next-btn").style.display = "none"; // 次へボタン非表示

    saveQuizProgress();
    updateProgress();  // 進行状況を更新

    // 自動読み上げ機能がオンなら単語を2回読み上げ
    if (toggleAutoSpeak()) {
        playWord(word.word);

        // 2回目の再生タイマーを設定
//        speechTimeoutId = setTimeout(() => {
//            if (currentQuizIndex === quizWords.indexOf(word)) {
//                playWord(word.word);
//            }
//        }, 2500);
    }
}

// 進行状況の更新
function updateProgress() {
    const totalQuestions = quizWords.length;
    const answeredQuestions = currentQuizIndex + 1; // 進行状況の表示は1からカウント
    const progressText = `${answeredQuestions}/${totalQuestions}`;
    
    document.getElementById('progress').textContent = progressText; // 進行状況を表示
}

// 「戻る」ボタンを押した際の処理
function showRangeSelection() {
    hideAllSections();
    document.getElementById("range-selection").classList.remove("hidden");

    // クイズ進行中でも単語リストや進捗はリセットしない
}
function saveQuizProgress() {
    const quizState = {
        currentQuizIndex: currentQuizIndex,
        quizWords: quizWords
    };
    localStorage.setItem("quizProgress", JSON.stringify(quizState));
}

function loadQuizProgress() {
    const quizState = JSON.parse(localStorage.getItem("quizProgress"));
    if (quizState) {
        quizWords = quizState.quizWords || [];
        currentQuizIndex = quizState.currentQuizIndex || 0;
    } else {
        quizWords = [];
        currentQuizIndex = 0;
    }
}
document.body.addEventListener("click", () => {
    const dummy = new Audio();
    dummy.play().catch(() => {});
}, { once: true });
// グローバル変数：最後に再生された単語
let lastPlayedWord = "";
let speechTimeoutId; // 音声再生タイマーのID  
let currentWordIndex = 0; // 現在の再生対象単語のインデックス  
let isAudioUnlocked = false; // ブラウザの音声再生が許可されたかどうか
let isPlaying = false; // 現在の音声再生状態
let currentAudio = null;

function playWord(word) {
	if (!word) {
        alert("単語が指定されていません。");
        return;
    }
	    // 既存の再生があれば止める
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }

  const url = `https://ojaajo-sound.vercel.app/api/tts?text=${encodeURIComponent(word)}`;
  const audio = new Audio(url);

	  audio.play().then(() => {
	    lastPlayedWord = word;
	}).catch((err) => {
	    console.error("音声再生エラー:", err);
	    showToast("⚠️ 音声の再生に失敗しました。もう一度お試しください。");
	});
}

document.addEventListener("keydown", function(event) {
    if (event.shiftKey) {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            if (currentWordIndex >= 0 && currentWordIndex < selectedList.length) {
                let wordToPlay = selectedList[currentWordIndex].word;
                lastPlayedWord = wordToPlay; // 矢印キーで再生した単語を記録
                playWord(wordToPlay);
            }
        }
    }
});
// Shiftキー単独で最後に再生した単語を再生
document.addEventListener("keydown", function(event) {
    if (event.key === "Shift" && lastPlayedWord) {
        playWord(lastPlayedWord);
    }
});
// Shiftキーの処理
document.addEventListener("keydown", function (event) {
    if (event.key === "Shift" && lastPlayedWord) {
        // クイズ中かどうかを判定
        const isQuizActive = !document.getElementById("quiz-section").classList.contains("hidden");

        if (isQuizActive) {
            // クイズ中の場合：現在の問題の単語を再生
            const word = quizWords[currentQuizIndex - 1]; // 現在の問題の単語を取得
            playWord(word.word);
        } else {
            // 単語一覧表示中の場合：最後に再生された単語を再生
            if (lastPlayedWord) {
                playWord(lastPlayedWord);
            }
        }
    }
});
// 矢印キーの処理
document.addEventListener("keydown", function (event) {
  // 入力中（INPUT/TEXTAREA/contenteditable）は奪わない
  const t = event.target;
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  if (typing) return;

  const isQuizActive = !document.getElementById("quiz-section").classList.contains("hidden");

  // --- Shift単独：最後の単語 or クイズ中は現在の単語を再生 ---
  if (event.key === "Shift") {
    if (isQuizActive) {
      // クイズ中：現在の問題の単語を再生
      if (typeof quizWords !== "undefined" && quizWords[currentQuizIndex - 1]) {
        playWord(quizWords[currentQuizIndex - 1].word);
      }
    } else if (lastPlayedWord) {
      // 単語一覧表示中：最後に再生された単語を再生
      playWord(lastPlayedWord);
    }
    return;
  }

  // --- クイズ中は矢印キー無効 ---
  if (isQuizActive) return;

  // --- 矢印↑↓：画面ボタンと同じ処理に統一 ---
 
  // iPad Safariでのフォーカス飛び防止
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    event.stopPropagation(); // ←追加（重要）
  }

  if (event.key === "ArrowDown") {
    playNextWord();
  } else if (event.key === "ArrowUp") {
    playPreviousWord();
  }
});

function playPreviousWord() {
    const wordListRows = document.querySelectorAll("#word-list-body tr:not([style*='display: none'])");
    if (wordListRows.length === 0) return; // 単語リストが空なら何もしない

    if (currentWordIndex > 0) {
        currentWordIndex--;
    }
    const prevWord = wordListRows[currentWordIndex]
    playWordAtIndex(currentWordIndex, wordListRows);
    scrollTable("up");
}
function playNextWord() {
    const wordListRows = document.querySelectorAll("#word-list-body tr:not([style*='display: none'])");
    if (currentWordIndex < wordListRows.length - 1) {
        currentWordIndex++;
    }
    playWordAtIndex(currentWordIndex, wordListRows);
    scrollTable("down");
}

// スクロール量（ピクセル単位）
const scrollStep = 42;

// 表のスクロールを行う関数
function scrollTable(direction) {
    const scrollableTable = document.getElementById("scrollable-table");
    if (direction === "down") {
        scrollableTable.scrollTop += scrollStep;
    } else if (direction === "up") {
        scrollableTable.scrollTop -= scrollStep;
    }
}

// 単語を再生（`currentWordIndex` の変更はここでは行わない）
function playWordAtIndex(index, wordListRows) {
    if (!wordListRows || wordListRows.length === 0 || index < 0 || index >= wordListRows.length) return;

    const word = wordListRows[index]
        .querySelector("td:first-child")
        .textContent.trim()
        .replace(/📢/, ""); // スピーカーマークを除去

    playWord(word);
    lastPlayedWord = word;
    currentWordIndex = index;
}

// ボタンのクリックイベント
// document.getElementById("up-button").addEventListener("click", () => {
//     const wordListRows = document.querySelectorAll("#word-list-body tr:not([style*='display: none'])");
//     if (currentWordIndex > 0) {
//         currentWordIndex--;
//     }
//     playWordAtIndex(currentWordIndex, wordListRows);
//     scrollTable("up");
// });
// document.getElementById("down-button").addEventListener("click", () => {
//     const wordListRows = document.querySelectorAll("#word-list-body tr:not([style*='display: none'])");
//     if (currentWordIndex < wordListRows.length - 1) {
//         currentWordIndex++;
//     }
//     playWordAtIndex(currentWordIndex, wordListRows);
//     scrollTable("down");
// });

function repeatLastWord() {
    if (lastPlayedWord) {
        playWord(lastPlayedWord);
    }
}
////////////////////// 単語一覧の表示関数/////////////////////////////////////////////
    // 韓国語の表示/非表示を切り替える関数
    function toggleKorean() {
        const isChecked = document.getElementById("toggle-korean").checked;
        document.querySelectorAll("#word-list-body tr td:first-child").forEach(td => {
            td.classList.toggle("hidden-korean", isChecked);
        });
    }
    // 意味の表示/非表示を切り替える関数
    function toggleMeaning() {
        const isChecked = document.getElementById("toggle-meaning").checked;
        document.querySelectorAll("#word-list-body tr td:nth-child(2)").forEach(td => {
            td.classList.toggle("hidden-meaning", isChecked);
        });
    }

function playWordFromSpeaker(word) {
    playWord(word);

    const wordListRows = document.querySelectorAll("#word-list-body tr:not([style*='display: none'])");
    for (let i = 0; i < wordListRows.length; i++) {
        const rowWord = wordListRows[i].querySelector("td:first-child").textContent
            .replace(/📢/, "")
            .trim();
        if (rowWord === word) {
            currentWordIndex = i;
            break;
        }
    }
}

async function loadProgressFromSupabase(level) {
    const { data: { user }, error: userError } =
        await supabaseClient.auth.getUser();

    if (userError || !user) return;

    const dbListKey = level.startsWith("custom:")
        ? level.slice("custom:".length)
        : level;

    const { data, error } = await supabaseClient
        .from("word_progress")
        .select("word, status")
        .eq("user_id", user.id)
        .eq("list_key", dbListKey);

    if (error) {
        console.error("暗記状況の読み込みエラー:", error);
        throw error;
    }

    selectedList.forEach(word => {
        delete word.status;
    });

    (data || []).forEach(row => {
        const wordObj = selectedList.find(
            word => word.word === row.word
        );

        if (wordObj) {
            wordObj.status = row.status;
        }
    });
}

async function showSelectedWordList() {
    const level = document.getElementById("wordlist-level-select").value;

    try {
        if (level.startsWith("custom:")) {
            // 自作リストをSupabaseから読み込む
            await loadCustomWordList(level.slice("custom:".length));
        } else {
            // 通常のリストを読み込む
            setWordList(level);
        }

        const startPage = parseInt(
            document.getElementById("wordlist-start-page").value,
            10
        );
        const endPage = parseInt(
            document.getElementById("wordlist-end-page").value,
            10
        );
        const shuffle = document.getElementById("wordlist-shuffle").checked;

        const filteredWords = selectedList.filter(word =>
            (Number(word.page) || 1) >= startPage &&
            (Number(word.page) || 1) <= endPage
        );

        if (shuffle) {
            filteredWords.sort(() => Math.random() - 0.5);
        }
// Supabaseから暗記状況を読み込む
await loadProgressFromSupabase(level);

// 単語一覧を表示
showWordList(filteredWords, level);
        requestAnimationFrame(updateWordSummary);
} catch (error) {
    const detail = error?.message || String(error);
    alert("エラー詳細:\n" + detail);
    console.error("単語リストの表示に失敗しました:", error);
}
}
// ✅ 開始を変えたら終了も同じページに自動同期（右を左に揃える）
function syncEndToStart(startId, endId) {
  const s = document.getElementById(startId);
  const e = document.getElementById(endId);
  if (!s || !e) return;
  e.value = s.value;                       // 右を左に揃える
  e.dispatchEvent(new Event("change"));    // 依存処理があれば発火
}

// ✅ 左(開始)と右(終了)の連動セットアップ
function setupLinkedPageSelectors(startId, endId) {
  const startSel = document.getElementById(startId);
  const endSel   = document.getElementById(endId);
  if (!startSel || !endSel) return;

  // 左を変えたら右を同期＆範囲制限
  startSel.addEventListener("change", () => {
    const startVal = parseInt(startSel.value, 10);
    const options  = [...endSel.querySelectorAll("option")];

    // ① 右の選択肢から、左より小さいページを非表示（消す）
    options.forEach(opt => {
      const v = parseInt(opt.value, 10);
      if (isNaN(v)) return;
      opt.hidden = v < startVal;
    });

    // ② 現在の右の値が左より小さい場合は自動で揃える
    const endVal = parseInt(endSel.value, 10);
    if (isNaN(endVal) || endVal < startVal) {
      endSel.value = startSel.value;
    }
  });
}

// ✅ ページロード時に一度だけ初期化
document.addEventListener('DOMContentLoaded', () => {
  setupLinkedPageSelectors('wordlist-start-page', 'wordlist-end-page');
  setupLinkedPageSelectors('start-page', 'end-page');
});

document.addEventListener('DOMContentLoaded', () => {
  setupLinkedPageSelectors('wordlist-start-page', 'wordlist-end-page');
  setupLinkedPageSelectors('start-page', 'end-page');
});

function setupLinkedPageSelectors(startId, endId) {
  const startSel = document.getElementById(startId);
  const endSel   = document.getElementById(endId);
  if (!startSel || !endSel) return;

  // ✅ 初回に右側の全<option>を丸ごと退避（クローンして保持）
  if (!endSel._allOptions) {
    endSel._allOptions = Array.from(endSel.options).map(o => o.cloneNode(true));
  }

  const rebuild = () => {
    const startVal = parseInt(startSel.value, 10);
    if (isNaN(startVal)) return;

    // ✅ 退避しておいた全候補から、左以上のものだけで右<select>を再生成
    endSel.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const opt of endSel._allOptions) {
      const v = parseInt(opt.value, 10);
      if (isNaN(v) || v >= startVal) {
        frag.appendChild(opt.cloneNode(true)); // クローンで挿入
      }
    }
    endSel.appendChild(frag);

    // 右の現在値が小さすぎる/未設定なら、左に揃える
    const endVal = parseInt(endSel.value, 10);
    if (isNaN(endVal) || endVal < startVal) {
      endSel.value = String(startVal);
    }

    // 必要なら依存処理を発火
    endSel.dispatchEvent(new Event('change'));
  };

  // 左変更時に右を再構築
  startSel.addEventListener('change', rebuild);

  // 初期表示でも一度同期（任意だがオススメ）
  rebuild();
}

// 単語一覧表示関数（ローカルストレージのデータを適用）
function showWordList(filteredWords, level) {
    currentWordIndex = 0;
    hideAllSections();

    let shuffleCheckbox = document.getElementById("wordlist-shuffle");
    if (!shuffleCheckbox) return;

    if (shuffleCheckbox.checked) {
        filteredWords = [...filteredWords].sort(() => Math.random() - 0.5);
    }

    const wordListBody = document.getElementById("word-list-body");
    wordListBody.innerHTML = "";

    filteredWords.forEach(word => {
        let statusClass = "";
        let statusText = "";
        if (word.status === "暗記済") {
            statusClass = "green";
            statusText = "〇";
        } else if (word.status === "未暗記") {
            statusClass = "red";
            statusText = "×";
        }

        const row = document.createElement("tr");
        row.innerHTML = `
            <td class="col-word">${word.word}  
                <span onclick="playWordFromSpeaker('${word.word}')" style="font-size: 12px; cursor: pointer;">📢</span>
            </td>
            <td class="col-meaning">${word.meaning}</td>
            <td class="${statusClass}" onclick="toggleWordStatus(this, '${word.word}')">${statusText}</td>
        `;
        wordListBody.appendChild(row);
    });

    filterWordList();
    document.getElementById("word-list").classList.remove("hidden");
}

function toggleWordStatus(cell, wordText) {
    let currentStatus = cell.textContent.trim();
    let newStatus = "";
    let newClass = "";

    if (currentStatus === "〇") {
        newStatus = "×";
        newClass = "red";
    } else if (currentStatus === "×") {
        newStatus = "";
        newClass = "";
    } else {
        newStatus = "〇";
        newClass = "green";
    }

    // セルの見た目を更新
    cell.textContent = newStatus;
    cell.className = newClass;

    // データ構造を更新
    const wordObj = selectedList.find(w => w.word === wordText);
    if (wordObj) {
        if (newStatus === "〇") {
            wordObj.status = "暗記済";
        } else if (newStatus === "×") {
            wordObj.status = "未暗記";
        } else {
            delete wordObj.status;
        }
    }

    // クラウド保存処理に変更を通知
    const listKey = document.getElementById("wordlist-level-select").value;
    const status = newStatus === ""
        ? null
        : newStatus === "〇" ? "暗記済" : "未暗記";

    window.dispatchEvent(new CustomEvent("word-progress-changed", {
        detail: {
            listKey: listKey,
            word: wordText,
            status: status
        }
    }));

    // フィルターが有効な場合は再適用
    // filterWordList();
}

document.addEventListener("DOMContentLoaded", function () {
  const btn = document.getElementById("word-list-show-btn");
  if (btn) {
    btn.addEventListener("click", showSelectedWordList); 
  }
});

document.addEventListener("DOMContentLoaded", function () {
    const scrollableTable = document.getElementById("scrollable-table");

    // iPadでもフォーカスを当てられるようにする
    scrollableTable.addEventListener("click", () => {
        scrollableTable.focus();
    });

});

// document.addEventListener('DOMContentLoaded', function() {
//     // ボタンのクリックイベントリスナーをここで追加
//     document.getElementById("intermediate-word-list-btn").addEventListener("click", showIntermediateWordList);
//     document.getElementById("beginner-word-list-btn").addEventListener("click", showBeginnerWordList);
//     document.getElementById("start
        

// 範囲を基に単語一覧を表示する関数
function showFilteredWordList() {
    const startPage = parseInt(wordListStartPageSelect.value);
    const endPage = parseInt(wordListEndPageSelect.value);
    if (startPage > endPage) {
        alert("開始ページは終了ページ以下にしてください。");
        return;
    }
    // 現在選択されているリストを取得
    const filteredWords = selectedList.filter(word => word.page >= startPage && word.page <= endPage);
    if (filteredWords.length === 0) {
        alert("選択範囲内に単語がありません。");
        return;
    }
    showWordList(filteredWords);
}
function filterWordList() {
    const hideCorrect = document.getElementById("hide-correct").checked;
    const hideIncorrect = document.getElementById("hide-incorrect").checked;
    const hideUnattempted = document.getElementById("hide-unattempted").checked;
    const wordListBody = document.getElementById("word-list-body");
    const rows = wordListBody.querySelectorAll("tr");

    rows.forEach(row => {
        const correctCell = row.querySelector("td:nth-child(3)"); // 正解/不正解状態を表示するセル
        const statusText = correctCell.textContent;
        let hideRow = false;
        if (hideCorrect && statusText === "〇") {
            hideRow = true;
        }
        if (hideIncorrect && statusText === "×") {
            hideRow = true;
        }
        if (hideUnattempted && statusText === "") {
            hideRow = true;
        }
        // 行を非表示にする
        row.style.display = hideRow ? "none" : "";
    });
}
        // セクションの表示切り替え
        function showRangeSelection() {
            hideAllSections();
            document.getElementById("range-selection").classList.remove("hidden");
        }
        function showQuizSection() {
            hideAllSections();
            document.getElementById("quiz-section").classList.remove("hidden");
        }
        function hideAllSections() {
            document.querySelectorAll(".section, .table-container").forEach(section => {
                section.classList.add("hidden");
            });
        }
        showRangeSelection();
        
		function updateWordSummary(){
		  const tbody = document.getElementById('word-list-body');
		  if(!tbody) return;

		  const rowsAll = [...tbody.querySelectorAll('tr')];

		  const countBy = (rows) => {
		    let done=0, not=0, none=0;
		    rows.forEach(tr=>{
		      const td = tr.querySelector('td:nth-child(3)');
		      if(!td) return;
		      const txt = td.textContent.trim();
		      if (txt === '〇' || td.classList.contains('green')) done++;
		      else if (txt === '×' || td.classList.contains('red')) not++;
		      else none++;
		    });
		    return {done, not, none, total: done+not+none};
		  };

		  // ✅ 表示/非表示に関係なく全体をカウント
		  const c = countBy(rowsAll);

		  // 更新
		  document.querySelector('.status-item.green b').textContent = c.done;
		  document.querySelector('.status-item.red b').textContent   = c.not;
		  document.querySelector('.status-item.gray b').textContent  = c.none;
		  document.querySelector('.summary-total b').textContent     = c.total;

		  const total = c.total || 1; // 0除算防止
		  document.getElementById('bar-done').style.width = (c.done/total*100)+'%';
		  document.getElementById('bar-not').style.width  = (c.not/total*100)+'%';
		  document.getElementById('bar-none').style.width = (c.none/total*100)+'%';
		}
				// --- 自動更新フック ---
			['showWordList','toggleWordStatus','filterWordList'].forEach(fn=>{
			  const orig = window[fn];
			  if(typeof orig==='function'){
			    window[fn] = function(){
			      const r = orig.apply(this, arguments);
			      requestAnimationFrame(updateWordSummary);
			      return r;
			    };
			  }
			});

// ✅ チェックボックスのON/OFFで即反映（構造に依存しない）
document.addEventListener("DOMContentLoaded", () => {
  const ids = ["hide-correct", "hide-incorrect", "hide-unattempted"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      if (typeof filterWordList === "function") filterWordList();
      requestAnimationFrame(updateWordSummary);
    });
  });
});


document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.getElementById('scrollable-table');
  const tbody = document.getElementById('word-list-body');

  const chkWord    = document.getElementById('toggle-col-word');
  const chkMeaning = document.getElementById('toggle-col-meaning');

  // 列の一括非表示トグル
  chkWord?.addEventListener('change', () => {
    wrap.classList.toggle('hide-col-word', chkWord.checked);
    clearPeek('word');
  });
  chkMeaning?.addEventListener('change', () => {
    wrap.classList.toggle('hide-col-meaning', chkMeaning.checked);
    clearPeek('meaning');
  });

  // セル個別トグル（隠れているときだけ効く）
  tbody?.addEventListener('click', (e) => {
    const td = e.target.closest('td');
    if (!td) return;

    // 単語列
    if (wrap.classList.contains('hide-col-word') && td.classList.contains('col-word')) {
      e.stopPropagation(); // 他のクリック処理（発音再生など）を止める
      td.classList.toggle('peek-cell');
      return;
    }
    // 意味列
    if (wrap.classList.contains('hide-col-meaning') && td.classList.contains('col-meaning')) {
      e.stopPropagation();
      td.classList.toggle('peek-cell');
      return;
    }
  });

  function clearPeek(which){
    const sel = which === 'word' ? 'td.col-word.peek-cell' : 'td.col-meaning.peek-cell';
    document.querySelectorAll(sel).forEach(td => td.classList.remove('peek-cell'));
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.getElementById("word-list-menu-btn");
  const menu = document.getElementById("word-list-menu");

  if (!menuButton || !menu) return;

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  menu.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    menu.hidden = true;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      menu.hidden = true;
    }
  });
});

/* ===== 単語リスト全体の検索機能 ===== */
document.addEventListener("DOMContentLoaded", () => {
  const searchButton = document.getElementById("word-list-search-btn");
  const searchArea = document.getElementById("word-search-area");
  const searchInput = document.getElementById("word-search-input");
  const clearButton = document.getElementById("word-search-clear-btn");
  const searchCount = document.getElementById("word-search-count");
  const wordListBody = document.getElementById("word-list-body");

  if (
    !searchButton ||
    !searchArea ||
    !searchInput ||
    !clearButton ||
    !searchCount ||
    !wordListBody
  ) {
    console.error("単語検索に必要なHTMLが見つかりません。");
    return;
  }

  let searchActive = false;

  function restoreNormalWordList() {
    const startSelect = document.getElementById("wordlist-start-page");
    const endSelect = document.getElementById("wordlist-end-page");
  
    const startPage = Number(startSelect?.value);
    const endPage = Number(endSelect?.value);
  
    if (
      !Number.isFinite(startPage) ||
      !Number.isFinite(endPage) ||
      startPage > endPage
    ) {
      return;
    }
  
    const normalWords = selectedList.filter(word => {
      const page = Number(word.page);
      return page >= startPage && page <= endPage;
    });
  
    if (normalWords.length > 0) {
      showWordList(normalWords);
    }
  }
  // 選択中のリスト全体から検索して結果を表示
  function renderWordSearchResults() {
    const query = searchInput.value.trim().toLocaleLowerCase();

    if (!query) {
      restoreNormalWordList();
      searchCount.textContent = "韓国語・日本語を入力して検索";
      return;
    }

    loadAnswersFromStorage();

    const results = selectedList.filter(word => {
      const korean = String(word.word || "").toLocaleLowerCase();
      const meaning = String(word.meaning || "").toLocaleLowerCase();

      return korean.includes(query) || meaning.includes(query);
    });

    wordListBody.innerHTML = "";

    results.forEach(word => {
      const row = document.createElement("tr");

      const wordCell = document.createElement("td");
      wordCell.className = "col-word";
      wordCell.appendChild(document.createTextNode(word.word + " "));

      const speaker = document.createElement("span");
      speaker.textContent = "📢";
      speaker.style.fontSize = "12px";
      speaker.style.cursor = "pointer";
      speaker.addEventListener("click", () => {
        playWordFromSpeaker(word.word);
      });
      wordCell.appendChild(speaker);


      const meaningCell = document.createElement("td");
      meaningCell.className = "col-meaning";
      
      const meaningParts = String(word.meaning || "").split(/(<br\s*\/?>|&lt;br\s*\/?&gt;)/gi);
      
      meaningParts.forEach(part => {
        if (/^(<br\s*\/?>|&lt;br\s*\/?&gt;)$/i.test(part)) {
          meaningCell.appendChild(document.createElement("br"));
        } else {
          meaningCell.appendChild(document.createTextNode(part));
        }
      });


      const statusCell = document.createElement("td");
      let statusText = "";

      if (word.status === "暗記済") {
        statusText = "〇";
        statusCell.className = "green";
      } else if (word.status === "未暗記") {
        statusText = "×";
        statusCell.className = "red";
      }

      statusCell.textContent = statusText;
      statusCell.addEventListener("click", () => {
        toggleWordStatus(statusCell, word.word);
      });

      row.append(wordCell, meaningCell, statusCell);
      wordListBody.appendChild(row);
    });

    searchCount.textContent = results.length + "件見つかりました";

    filterWordList();

    if (typeof updateWordSummary === "function") {
      updateWordSummary();
    }
  }

  // 虫眼鏡を押して検索欄を開く
  searchButton.addEventListener("click", () => {
    searchActive = true;
    searchArea.hidden = false;
    searchArea.style.display = "block";
    searchInput.value = "";
    searchCount.textContent = "韓国語・日本語を入力して検索";
    searchInput.focus();
  });

  // 入力するたびにリスト全体を検索
  searchInput.addEventListener("input", () => {
    if (searchActive) {
      renderWordSearchResults();
    }
  });

  // ×を押して検索を終了し、通常表示に戻す
  function closeWordSearch() {
    searchActive = false;
    searchInput.value = "";
    searchArea.hidden = true;
    searchArea.style.display = "none";
    searchCount.textContent = "";
  
   restoreNormalWordList();
  }

  clearButton.addEventListener("click", closeWordSearch);

  // Escキーでも検索を終了
  searchInput.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeWordSearch();
    }
  });
});
/* ===== 単語リスト全体の検索機能ここまで ===== */


////ファイル進捗出力///////////////////////////////////////////////////////////////////////////
function exportProgress() {
    const answers = JSON.parse(localStorage.getItem("quizAnswers")) || [];
    const jsonString = JSON.stringify(answers, null, 2);

    const outputArea = document.getElementById("json-output");
    const textArea = document.getElementById("json-text");

    textArea.value = jsonString;
    outputArea.classList.remove("hidden");
    textArea.scrollTop = 0;
    textArea.select(); // 自動で全選択

    showToast("コピーして保存してください！");
}

function importProgress(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                localStorage.setItem("quizAnswers", JSON.stringify(data));
                showToast("暗記状況を読み込みました！");
                setTimeout(() => location.reload(), 1000);
            } else {
                alert("ファイルの形式が正しくありません。");
            }
        } catch (error) {
            alert("読み込みに失敗しました。JSON形式のファイルを選んでください。");
        }
    };
    reader.readAsText(file);
}

function copyToClipboard() {
    const textArea = document.getElementById("json-text");
    textArea.select();
    document.execCommand("copy");
    showToast("コピーしました！");
}

function showToast(message, duration = 3000) {
    const toast = document.getElementById("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, duration);
}


async function refreshCustomListOptions() {
  const select = document.getElementById("custom-list-destination");
  if (!select) return;

  const previousValue = select.value;

  select.innerHTML = `
    <option value="new">新しいリストを作成</option>
  `;

  try {
    const { data: { user }, error: userError } =
      await supabaseClient.auth.getUser();

    if (userError) throw userError;
    if (!user) return;

    const { data: lists, error } = await supabaseClient
      .from("vocab_lists")
      .select("list_key, name")
      .eq("user_id", user.id)
      .order("name");

    if (error) throw error;

    (lists || []).forEach(list => {
      const option = document.createElement("option");
      option.value = list.list_key;
      option.textContent = list.name;
      select.appendChild(option);
    });

    if ([...select.options].some(option => option.value === previousValue)) {
      select.value = previousValue;
    }
  } catch (error) {
    console.error("単語リスト取得エラー:", error);
  }
}
// 通常の単語一覧の選択欄に、自作リストを追加する
async function refreshCustomWordListOptions() {
  const select = document.getElementById("wordlist-level-select");
  if (!select) return;

  // 以前追加した自作リストの選択肢だけを削除
  select.querySelectorAll('option[data-custom-list="true"]')
    .forEach(option => option.remove());

  try {
    const { data: { user }, error: userError } =
      await supabaseClient.auth.getUser();

    if (userError) throw userError;
    if (!user) return;

    const { data: lists, error } = await supabaseClient
      .from("vocab_lists")
      .select("list_key, name")
      .eq("user_id", user.id)
      .order("name");

    if (error) throw error;

    (lists || []).forEach(list => {
      const option = document.createElement("option");
      option.value = `custom:${list.list_key}`;
      option.textContent = list.name;
      option.dataset.customList = "true";
      select.appendChild(option);
    });
  } catch (error) {
    console.error("自作リストの選択肢取得エラー:", error);
  }
}
document.getElementById("custom-list-destination")
  ?.addEventListener("change", () => {
    const select = document.getElementById("custom-list-destination");
    const nameArea = document.getElementById("custom-list-name-area");

    if (nameArea) {
      nameArea.style.display =
        select.value === "new" ? "block" : "none";
    }
  });

refreshCustomListOptions();
refreshCustomWordListOptions();

supabaseClient.auth.onAuthStateChange(() => {
  setTimeout(refreshCustomListOptions, 0);
});


document.getElementById("custom-list-import-btn")?.addEventListener("click", async () => {
  const fileInput = document.getElementById("custom-list-file");
  const message = document.getElementById("custom-list-import-message");
  const button = document.getElementById("custom-list-import-btn");
  const destination = document.getElementById("custom-list-destination");
  const nameInput = document.getElementById("custom-list-name");

  const file = fileInput?.files?.[0];
  const selectedDestination = destination?.value;
  const newListName = nameInput?.value.trim();

  if (selectedDestination === "new" && !newListName) {
    message.textContent = "新しいリストの名前を入力してください。";
    nameInput?.focus();
    return;
  }

  if (!selectedDestination) {
    message.textContent = "登録先のリストを選択してください。";
    return;
  }

  if (!file) {
    message.textContent = ".txtファイルを選択してください。";
    return;
  }

  button.disabled = true;
  message.textContent = "読み込み中です…";

  let createdListKey = null;

  try {
    const { data: { user }, error: userError } =
      await supabaseClient.auth.getUser();

    if (userError) throw userError;
    if (!user) {
      throw new Error("先にSupabaseへログインしてください。");
    }

    const fileText = await file.text();
    const lines = fileText.split(/\r?\n/);
    const importedWords = [];
    const seen = new Set();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const colonIndex = line.indexOf(":");

      if (colonIndex < 1) {
        throw new Error(
          `${i + 1}行目に「:」がありません。形式を確認してください。`
        );
      }

      const word = line.slice(0, colonIndex).trim();
      const meaning = line.slice(colonIndex + 1).trim();

      if (!word || !meaning) {
        throw new Error(
          `${i + 1}行目の単語または意味が空です。`
        );
      }

      if (seen.has(word)) continue;
      seen.add(word);

      importedWords.push({ word, meaning });
    }

    if (importedWords.length === 0) {
      throw new Error("登録できる単語がありません。");
    }

    let listKey;
    let listName;

    if (selectedDestination === "new") {
      const { data: sameNameLists, error: nameError } =
        await supabaseClient
          .from("vocab_lists")
          .select("list_key")
          .eq("user_id", user.id)
          .eq("name", newListName);

      if (nameError) throw nameError;

      if (sameNameLists && sameNameLists.length > 0) {
        throw new Error(
          "同じ名前のリストがすでにあります。既存リストを選ぶか、別の名前を入力してください。"
        );
      }

      listKey = `custom_${crypto.randomUUID()}`;
      listName = newListName;
      createdListKey = listKey;

      const { error: listError } = await supabaseClient
        .from("vocab_lists")
        .insert({
          user_id: user.id,
          list_key: listKey,
          name: listName
        });

      if (listError) throw listError;
    } else {
      listKey = selectedDestination;

      const { data: existingList, error: listError } =
        await supabaseClient
          .from("vocab_lists")
          .select("list_key, name")
          .eq("list_key", listKey)
          .eq("user_id", user.id)
          .single();

      if (listError) throw listError;
      if (!existingList) {
        throw new Error("選択したリストが見つかりません。");
      }

      listName = existingList.name;
    }

    const { data: existingWords, error: wordsReadError } =
      await supabaseClient
        .from("vocab_words")
        .select("word")
        .eq("list_key", listKey)
        .eq("user_id", user.id);

    if (wordsReadError) throw wordsReadError;

    const existingWordSet = new Set(
      (existingWords || []).map(item => item.word)
    );

    const newWords = importedWords.filter(
      item => !existingWordSet.has(item.word)
    );

    if (newWords.length === 0) {
      message.textContent =
        "追加できる新しい単語はありませんでした。";

      if (createdListKey) {
        await supabaseClient
          .from("vocab_lists")
          .delete()
          .eq("list_key", createdListKey)
          .eq("user_id", user.id);

        createdListKey = null;
      }

      await refreshCustomListOptions();
      return;
    }

    const existingCount = existingWordSet.size;

    const rows = newWords.map((item, index) => ({
      user_id: user.id,
      list_key: listKey,
      word: item.word,
      meaning: item.meaning,
      page: Math.floor((existingCount + index) / 80) + 1,
      example: null
    }));

    for (let i = 0; i < rows.length; i += 100) {
      const { error: insertError } = await supabaseClient
        .from("vocab_words")
        .insert(rows.slice(i, i + 100));

      if (insertError) throw insertError;
    }

    message.textContent =
      `保存しました！「${listName}」に${newWords.length}語を追加しました。`;

    fileInput.value = "";
    await refreshCustomListOptions();

  } catch (error) {
    console.error("単語リストの読み込みエラー:", error);

    if (createdListKey) {
      await supabaseClient
        .from("vocab_words")
        .delete()
        .eq("list_key", createdListKey)
        .eq("user_id", (await supabaseClient.auth.getUser()).data.user?.id);

      await supabaseClient
        .from("vocab_lists")
        .delete()
        .eq("list_key", createdListKey);
    }

    message.textContent =
      "読み込みに失敗しました: " +
      (error.message || "原因を確認できませんでした。");

  } finally {
    button.disabled = false;
  }
});
