const SUPABASE_URL = "https://ahessrcxqknznyplhnke.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QEUR0G9mbI0i6g3_F3gT_w_kEemLJQU";

  const supabaseClient = window.supabase.createClient(

    SUPABASE_URL,

    SUPABASE_PUBLISHABLE_KEY

  );

  async function testSupabaseConnection() {

    try {

      const { data, error } = await supabaseClient.auth.getSession();

      if (error) throw error;

      console.log(

        "Supabase接続OK",

        data?.session ? "ログイン中" : "未ログイン"

      );

    } catch (error) {

      console.error("Supabase接続エラー:", error);

    }

  }

  testSupabaseConnection();

  document.addEventListener("DOMContentLoaded", async () => {

  const panel = document.createElement("div");

  panel.style.cssText = `

    margin: 10px auto;

    padding: 12px;

    max-width: 600px;

    border: 1px solid #ccc;

    border-radius: 8px;

    font-size: 14px;

    background: #f5f5f5;

    color: #222;

  `;

  panel.textContent = "Supabase接続を確認しています…";

  document.body.prepend(panel);

  try {

    const { data, error } =

      await supabaseClient.auth.getSession();

    if (error) throw error;

    panel.textContent =

      "✅ Supabase接続OK（" +

      (data.session ? "ログイン中" : "未ログイン") +

      "）";

    panel.style.borderColor = "#26934a";

  } catch (error) {

    console.error("Supabase接続エラー:", error);

    panel.textContent =

      "❌ Supabase接続エラー: " +

      (error.message || String(error));

    panel.style.borderColor = "#d33";

  }

});

  document.addEventListener("DOMContentLoaded", async () => {

  const panel = document.createElement("section");

  panel.style.cssText = `

display: none;
position: fixed;
right: 16px;
bottom: 76px;
z-index: 10000;
width: min(420px, calc(100vw - 32px));
max-height: min(70vh, 620px);
overflow-y: auto;
margin: 0;
padding: 18px;
box-sizing: border-box;
background: white;
border: 1px solid #ddd;
border-radius: 16px;
color: #222;
font-family: sans-serif;
box-shadow: 0 8px 28px rgba(0, 0, 0, 0.2);

  `;

  panel.innerHTML = `

    <h3 style="margin-top:0">☁️ 暗記状況のクラウド同期</h3>

    <p id="sb-auth-status">ログイン状態を確認しています…</p>

    <div id="sb-auth-form">

      <label for="sb-email">メールアドレス</label>

      <input id="sb-email" type="email" autocomplete="email"

        placeholder="メールアドレス"

        style="display:block;width:100%;box-sizing:border-box;padding:10px;margin:6px 0 14px">

      <label for="sb-password">パスワード（6文字以上）</label>

      <input id="sb-password" type="password"

        autocomplete="current-password"

        placeholder="パスワード"

        style="display:block;width:100%;box-sizing:border-box;padding:10px;margin:6px 0 14px">

      <button id="sb-signup" type="button">新規登録</button>

      <button id="sb-login" type="button">ログイン</button>

    </div>

    <button id="sb-logout" type="button" hidden>ログアウト</button>

    <p id="sb-auth-message" role="status" aria-live="polite"></p>

  `;

  const header = document.querySelector("header");

  if (header) {

    header.before(panel);

  } else {

    document.body.prepend(panel);

  }
  const cloudButton = document.createElement("button");
  cloudButton.type = "button";
  cloudButton.id = "sb-cloud-toggle";
  cloudButton.textContent = "☁️";
  cloudButton.setAttribute("aria-label", "クラウド同期の設定を開く");
  cloudButton.setAttribute("aria-expanded", "false");

  cloudButton.style.cssText = `
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 10001;
    width: 52px;
    height: 52px;
    border: none;
    border-radius: 50%;
    background: #2563eb;
    color: white;
    font-size: 25px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  document.body.appendChild(cloudButton);

  cloudButton.addEventListener("click", () => {
    const isOpen = panel.style.display !== "none";
    panel.style.display = isOpen ? "none" : "block";
    cloudButton.setAttribute("aria-expanded", String(!isOpen));
  });

  const status = panel.querySelector("#sb-auth-status");

  const message = panel.querySelector("#sb-auth-message");

  const form = panel.querySelector("#sb-auth-form");

  const logoutButton = panel.querySelector("#sb-logout");

  const emailInput = panel.querySelector("#sb-email");

  const passwordInput = panel.querySelector("#sb-password");

  function showMessage(text) {

    message.textContent = text;

  }

  function updateUI(user) {

    if (user) {

      status.textContent = "✅ ログイン中：" + user.email;

      form.hidden = true;

      logoutButton.hidden = false;

    } else {

      status.textContent = "未ログイン";

      form.hidden = false;

      logoutButton.hidden = true;

    }

  }

  async function runAuth(action) {

    const email = emailInput.value.trim();

    const password = passwordInput.value;

    if (!email || !password) {

      showMessage("メールアドレスとパスワードを入力してください。");

      return;

    }

    if (password.length < 6) {

      showMessage("パスワードは6文字以上で入力してください。");

      return;

    }

    const buttons = [

      panel.querySelector("#sb-signup"),

      panel.querySelector("#sb-login"),

      logoutButton

    ];

    buttons.forEach(button => button.disabled = true);

    showMessage("処理しています…");

    try {

      if (action === "signup") {

        const { data, error } = await supabaseClient.auth.signUp({

          email,

          password

        });

        if (error) throw error;

        if (data.session) {

          showMessage("新規登録・ログインが完了しました。");

        } else {

          showMessage(

            "登録を受け付けました。メール確認が必要な場合は、届いたメールの案内に従ってください。"

          );

        }

      } else {

        const { error } =

          await supabaseClient.auth.signInWithPassword({

            email,

            password

          });

        if (error) throw error;

        showMessage("ログインしました。");

      }

    } catch (error) {

      console.error("認証エラー:", error);

      showMessage("エラー：" + (error.message || "認証に失敗しました。"));

    } finally {

      buttons.forEach(button => button.disabled = false);

    }

  }

  panel.querySelector("#sb-signup").addEventListener(

    "click", () => runAuth("signup")

  );

  panel.querySelector("#sb-login").addEventListener(

    "click", () => runAuth("login")

  );

  logoutButton.addEventListener("click", async () => {

    logoutButton.disabled = true;

    showMessage("ログアウトしています…");

    try {

      const { error } = await supabaseClient.auth.signOut();

      if (error) throw error;

      showMessage("ログアウトしました。");

    } catch (error) {

      showMessage("エラー：" + (error.message || "ログアウトに失敗しました。"));

    } finally {

      logoutButton.disabled = false;

    }

  });

  const { data, error } = await supabaseClient.auth.getUser();

  if (error && error.name !== "AuthSessionMissingError") {

    console.error(error);

  }

  updateUI(data?.user || null);

  supabaseClient.auth.onAuthStateChange((_event, session) => {

    updateUI(session?.user || null);
  });
    // 単語の進捗をクラウドに保存する
  window.addEventListener("word-progress-changed", async (event) => {
    const { listKey, word, status } = event.detail || {};
    const dbListKey = listKey.startsWith("custom:")
  ? listKey.slice("custom:".length)
  : listKey;

    // 同期対象は4つのリストだけ
if (
  !["beginner", "intermediate", "advanced", "expressionup"].includes(listKey) &&
  !listKey.startsWith("custom:")
) {
  return;
}

    const { data: { user }, error: userError } =
      await supabaseClient.auth.getUser();

    if (userError || !user) return;

    // 暗記状況を未設定に戻した場合はクラウドから削除
    if (status === null) {
      const { error } = await supabaseClient
        .from("word_progress")
        .delete()
        .eq("user_id", user.id)
        .eq("list_key", dbListKey)
        .eq("word", word);

      if (error) console.error("クラウド削除エラー:", error);
      return;
    }

    // すでに保存されている単語か確認
    const { data: existingRows, error: selectError } =
      await supabaseClient
        .from("word_progress")
        .select("word")
        .eq("user_id", user.id)
        .eq("list_key", dbListKey)
        .eq("word", word)
        .limit(1);

    if (selectError) {
      console.error("クラウド確認エラー:", selectError);
      return;
    }

    if (existingRows && existingRows.length > 0) {
      // 既存データを更新
      const { error } = await supabaseClient
        .from("word_progress")
        .update({ status })
        .eq("user_id", user.id)
        .eq("list_key", dbListKey)
        .eq("word", word);

      if (error) console.error("クラウド更新エラー:", error);
    } else {
      // 新しい単語を保存
      const { error } = await supabaseClient
        .from("word_progress")
        .insert({
          user_id: user.id,
          list_key: dbListKey,
          word: word,
          status: status
        });

      if (error) console.error("クラウド保存エラー:", error);
    }
  });

});
