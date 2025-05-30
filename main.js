let wasmBin = null;

function terminalWrite(text, className = "terminal-output") {
  const term = document.getElementById("terminal");
  const line = document.createElement("div");
  line.className = `terminal-line ${className}`;
  line.textContent = text;
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
}


// main.js
const compileBtn = document.getElementById("compile-btn");
const runBtn     = document.getElementById("run-btn");   // まだ使わない
const statusElm  = document.getElementById("compile-status");
const editorElm  = document.getElementById("editor");    // 既存 textarea

// Worker を作成（type:"module" を忘れずに）
const worker = new Worker("compiler.worker.js", { type: "module" });

// 「コンパイル」ボタン押下
compileBtn.addEventListener("click", () => {
  compileBtn.disabled = true;
  statusElm.textContent = "コンパイル中…";
  worker.postMessage({ type: "compile", code: editorElm.value });
});

// Worker からの返信
worker.onmessage = ({ data }) => {
  if (data.type === "compiled") {
    statusElm.textContent = "✓ コンパイル成功 (wasm " + data.wasmBin.length + "B)";
    // ★ 実行ステップは後で作るので runBtn を無効のまま残します
  } else if (data.type === "error") {
    statusElm.textContent = "✗ コンパイル失敗";
    console.error(data.message);
  }
  compileBtn.disabled = false;
};
