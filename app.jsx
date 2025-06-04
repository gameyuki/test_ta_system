const { useState, useRef, useEffect } = React;

function App() {
  const initialCode = `#include <stdio.h>

int main() {
    printf("Hello, WASI World!\n");

    char name[100];
    printf("お名前を入力してください: ");
    scanf("%s", name);
    printf("こんにちは、%sさん！\n", name);

    return 0;
}`;

  const [code, setCode] = useState(initialCode);
  const [terminalLines, setTerminalLines] = useState([]);
  const [compileStatus, setCompileStatus] = useState("");
  const [runDisabled, setRunDisabled] = useState(true);
  const [logs, setLogs] = useState([]);
  const [collectOutputs, setCollectOutputs] = useState(false);
  const [resultOutputs, setResultOutputs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [inputVisible, setInputVisible] = useState(false);
  const [resultText, setResultText] = useState("実行結果はまだ評価されていません");
  const [resultClass, setResultClass] = useState("result-display");
  const inputRef = useRef(null);
  const inputResolve = useRef(null);
  const wasmModule = useRef(null);

  const addLog = (type, message, details = {}) => {
    const log = { timestamp: new Date(), type, message, details };
    setLogs(prev => [...prev, log]);
  };

  const terminalWrite = (text, className = 'terminal-output') => {
    setTerminalLines(prev => [...prev, { text, className }]);
    if (collectOutputs) {
      setResultOutputs(prev => [...prev, text]);
    }
  };

  const clearTerminal = () => {
    setTerminalLines([]);
    addLog('terminal_clear', 'ターミナルをクリア');
  };

  const compile = async () => {
    setCompileStatus('<span class="loading"></span> コンパイル中...');
    setRunDisabled(true);
    addLog('compile_start', 'コンパイル開始', { codeLength: code.length });

    await new Promise(r => setTimeout(r, 800));

    const errors = [];
    if (!code.includes('#include')) errors.push('エラー: #include文が見つかりません');
    if (!code.includes('main')) errors.push('エラー: main関数が見つかりません');

    if (errors.length > 0) {
      terminalWrite('コンパイルエラー:', 'terminal-error');
      errors.forEach(err => terminalWrite(err, 'terminal-error'));
      setCompileStatus('<span style="color: #f85149;">✗ コンパイル失敗</span>');
      addLog('compile_error', 'コンパイルエラー', { errors });
      wasmModule.current = null;
    } else {
      wasmModule.current = { code, compiled: true };
      terminalWrite('コンパイル成功!', 'terminal-success');
      setCompileStatus('<span style="color: #3fb950;">✓ コンパイル成功</span>');
      addLog('compile_success', 'コンパイル成功');
      setRunDisabled(false);
    }
  };

  const run = async () => {
    if (!wasmModule.current || isRunning) return;
    setIsRunning(true);
    setRunDisabled(true);
    addLog('execution_start', 'プログラム実行開始');
    terminalWrite('\n--- プログラム実行開始 ---\n', 'terminal-success');
    setCollectOutputs(true);
    setResultOutputs([]);

    const codeStr = wasmModule.current.code;
    const printfMatches = codeStr.matchAll(/printf\("([^"]+)"(?:,\s*([^)]+))?\);/g);
    let userInputValue = null;
    for (const match of printfMatches) {
      let output = match[1];
      output = output.replace(/\\n/g, '\n');
      if (match[2] && output.includes('%s')) {
        if (output.includes('name')) {
          continue;
        }
      }
      terminalWrite(output);
      addLog('wasi_call', 'fd_write (printf)', { output });
      await new Promise(r => setTimeout(r, 100));
    }

    if (codeStr.includes('scanf')) {
      setInputVisible(true);
      inputRef.current && inputRef.current.focus();
      const input = await new Promise(resolve => {
        inputResolve.current = resolve;
      });
      userInputValue = input;
      setInputVisible(false);
      terminalWrite(input, 'terminal-input');
      addLog('wasi_call', 'fd_read (scanf)', { input });
      const lastPrintf = codeStr.match(/printf\("こんにちは、%sさん！\\n", name\);/);
      if (lastPrintf) {
        terminalWrite(`こんにちは、${input}さん！`);
        addLog('wasi_call', 'fd_write (printf with variable)', { output: `こんにちは、${input}さん！` });
      }
    }

    terminalWrite('\n--- プログラム終了 (終了コード: 0) ---\n', 'terminal-success');
    addLog('execution_end', 'プログラム実行終了', { exitCode: 0 });
    setCollectOutputs(false);
    checkResult(userInputValue);
    setIsRunning(false);
    setRunDisabled(false);
  };

  const checkResult = (userInput) => {
    const expected = ['Hello, WASI World!', 'お名前を入力してください: '];
    if (userInput !== null) {
      expected.push(userInput);
      expected.push(`こんにちは、${userInput}さん！`);
    }
    let correct = resultOutputs.length === expected.length;
    if (correct) {
      for (let i = 0; i < expected.length; i++) {
        if (resultOutputs[i] !== expected[i]) {
          correct = false;
          break;
        }
      }
    }
    if (correct) {
      setResultText('正解');
      setResultClass('result-display result-correct');
    } else {
      setResultText('不正解');
      setResultClass('result-display result-incorrect');
    }
  };

  const submitInput = () => {
    const val = inputRef.current.value;
    if (inputResolve.current) {
      inputResolve.current(val);
      inputResolve.current = null;
      inputRef.current.value = '';
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      submitInput();
    }
  };

  useEffect(() => {
    addLog('system_start', 'システム起動');
    terminalWrite('WASI学習支援システムへようこそ!', 'terminal-success');
    terminalWrite('左側のエディタでC言語コードを編集し、「コンパイル」→「実行」をしてください。\n');
  }, []);

  return (
    <div className="container">
      <div className="left-panel">
        <div className="header">
          <div className="title">エディタ</div>
          <div id="editor-status"></div>
        </div>
        <div className="editor-container">
          <textarea id="editor" spellCheck="false" value={code} onChange={e => { setCode(e.target.value); wasmModule.current = null; setRunDisabled(true); }} />
        </div>
        <div className="toolbar">
          <button id="compile-btn" onClick={compile}>コンパイル</button>
          <button id="run-btn" onClick={run} disabled={runDisabled}>実行</button>
          <button onClick={clearTerminal}>クリア</button>
          <div id="compile-status" dangerouslySetInnerHTML={{ __html: compileStatus }}></div>
        </div>
      </div>
      <div className="right-panel">
        <div className="header">
          <div className="title">実行結果</div>
        </div>
        <div className="terminal" id="terminal">
          {terminalLines.map((l, i) => (
            <div key={i} className={`terminal-line ${l.className}`}>{l.text}</div>
          ))}
        </div>
        {inputVisible && (
          <div className="input-container" id="input-container">
            <div className="input-prompt">
              <span>&gt;</span>
              <input type="text" className="input-field" ref={inputRef} onKeyPress={handleKeyPress} />
              <button onClick={submitInput}>送信</button>
            </div>
          </div>
        )}
        <div className="status-bar">
          <div id="status">{isRunning ? '実行中...' : '実行完了'}</div>
          <div id="log-count">ログ: {logs.length}件</div>
        </div>
        <div className={resultClass} id="result-display">{resultText}</div>
        <div className="log-panel" id="log-panel">
          <div style={{ color: '#58a6ff' }}>学習ログ (編集・コンパイル・実行の履歴)</div>
          {logs.map((log, i) => (
            <div key={i} className="log-entry">
              <span className="log-timestamp">[{log.timestamp.toLocaleTimeString()}]</span> {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
