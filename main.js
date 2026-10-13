import { WORDS } from "./words.js";
const words = WORDS;
// ---------------------- 基本状態 ----------------------
let completed = false;
let selectedList = []; // ← 初期選択は後でDOM読み込み後に決める
let currentListKey = "beginner";

// 単語配列マップ（存在する配列名に合わせてここだけ整備）
const WORD_MAP = {
  beginner:      WORDS.beginnerWords,
  intermediate:  WORDS.intermediateWords,
  advanced:      WORDS.advancedWords,
  expressionup:  WORDS.expressionUpWords,
  Level4:        WORDS.Level4ofkoreanschool,
  Level5:        WORDS.Level5ofkoreanschool,
};

// 出題用：現在の selectedList から範囲抽出
function getWordsInRange(start, end, onlyIncorrect) {
  return selectedList.filter(w =>
    w.page >= start && w.page <= end &&
    (!onlyIncorrect || w.status === "未暗記")
  );
}

// ---------------------- レベル選択とリスト決定 ----------------------
function setWordList(listType) {
  currentListKey = listType;
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
  wlLevel && wlLevel.addEventListener('change', () => {
    populatePageSelectorsFor('wordlist-level-select', 'wordlist-start-page', 'wordlist-end-page');
    // 単語一覧用として selectedList も更新
    setWordList(wlLevel.value);
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
window.startQuiz = startQuiz;
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
    if (["beginner", "intermediate", "advanced", "expressionup"].includes(currentListKey)) {
        window.dispatchEvent(new CustomEvent("word-progress-changed", {
            detail: {
                listKey: currentListKey,
                word: word.word,
                status: status
            }
        }));
    }
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
window.toggleAutoSpeak = toggleAutoSpeak;
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
window.markAnswer = markAnswer;
// 一つ前の問題に移動
function moveToPrevious() {
    if (currentQuizIndex > 0) {
        currentQuizIndex--;
        nextQuestion();  // 次の問題に進む処理を呼び出す
    }
}
window.moveToPrevious = moveToPrevious;
// 一つ次の問題に移動
function moveToNext() {
    if (currentQuizIndex < quizWords.length - 1) {
        currentQuizIndex++;
        nextQuestion();  // 次の問題に進む処理を呼び出す
    }
}
window.moveToNext = moveToNext;

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
window.nextQuestion = nextQuestion;
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
window.showRangeSelection = showRangeSelection;
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
window.playWord = playWord;
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
window.playPreviousWord = playPreviousWord;
function playNextWord() {
    const wordListRows = document.querySelectorAll("#word-list-body tr:not([style*='display: none'])");
    if (currentWordIndex < wordListRows.length - 1) {
        currentWordIndex++;
    }
    playWordAtIndex(currentWordIndex, wordListRows);
    scrollTable("down");
}
window.playNextWord = playNextWord;
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
window.repeatLastWord = repeatLastWord;
////////////////////// 単語一覧の表示関数/////////////////////////////////////////////
    // 韓国語の表示/非表示を切り替える関数
    function toggleKorean() {
        const isChecked = document.getElementById("toggle-korean").checked;
        document.querySelectorAll("#word-list-body tr td:first-child").forEach(td => {
            td.classList.toggle("hidden-korean", isChecked);
        });
    }
    window.toggleKorean = toggleKorean;
    // 意味の表示/非表示を切り替える関数
    function toggleMeaning() {
        const isChecked = document.getElementById("toggle-meaning").checked;
        document.querySelectorAll("#word-list-body tr td:nth-child(2)").forEach(td => {
            td.classList.toggle("hidden-meaning", isChecked);
        });
    }
	window.toggleMeaning = toggleMeaning;
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

function showSelectedWordList() {
    const level = document.getElementById("wordlist-level-select").value;
    setWordList(level);

    const startPage = parseInt(document.getElementById("wordlist-start-page").value);
    const endPage = parseInt(document.getElementById("wordlist-end-page").value);
    const shuffle = document.getElementById("wordlist-shuffle").checked;

    const filteredWords = selectedList.filter(word => word.page >= startPage && word.page <= endPage);
    if (shuffle) {
        filteredWords.sort(() => Math.random() - 0.5);
    }

    showWordList(filteredWords, level);
    
    rebuildHiddenChips();                 // ← チップを再生成
    requestAnimationFrame(updateWordSummary); // ← 集計も更新
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
    loadAnswersFromStorage();
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

    // localStorageに保存
    let storedAnswers = JSON.parse(localStorage.getItem('quizAnswers')) || [];
    const existing = storedAnswers.find(a => a.word === wordText);
    if (existing) {
        if (newStatus === "") {
            storedAnswers = storedAnswers.filter(a => a.word !== wordText);
        } else {
            existing.status = newStatus === "〇" ? "暗記済" : "未暗記";
        }
    } else if (newStatus !== "") {
        storedAnswers.push({
            word: wordText,
            status: newStatus === "〇" ? "暗記済" : "未暗記"
        });
    }
    localStorage.setItem("quizAnswers", JSON.stringify(storedAnswers));
        // クラウド同期対象のリストだけ変更を通知
    if (["beginner", "intermediate", "advanced", "expressionup"].includes(currentListKey)) {
        window.dispatchEvent(new CustomEvent("word-progress-changed", {
            detail: {
                listKey: currentListKey,
                word: wordText,
                status: newStatus === "" ? null : (newStatus === "〇" ? "暗記済" : "未暗記")
            }
        }));
    }
    // フィルターが有効な場合は再適用
    // filterWordList();
}

document.addEventListener("DOMContentLoaded", function () {
  const btn = document.getElementById("word-list-show-btn");
  if (btn) {
    btn.addEventListener("click", showSelectedWordList); 
  }
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
window.exportProgress = exportProgress;
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
window.importProgress = importProgress;
function copyToClipboard() {
    const textArea = document.getElementById("json-text");
    textArea.select();
    document.execCommand("copy");
    showToast("コピーしました！");
}
window.copyToClipboard = copyToClipboard;
function showToast(message, duration = 3000) {
    const toast = document.getElementById("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, duration);
}