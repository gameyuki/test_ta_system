// compiler.worker.js
import initClang from "https://esm.sh/@wasmer/clang@17.0.0?wasm";

let clangInstance;

onmessage = async ({ data }) => {
  if (data.type !== "compile") return;

  // 初回だけ clang.wasm を読み込む（約7MB。キャッシュされます）
  if (!clangInstance) {
    clangInstance = await initClang({
      wasmURL: "https://cdn.wasmer.io/wasix/clang/17.0.0/clang.wasm"
    });
  }

  const { code } = data;
  clangInstance.FS.writeFile("/workspace/main.c", code);

  // C → WASM を実行
  const result = clangInstance.compile([
    "/workspace/main.c",
    "--target=wasm32-wasi",
    "-O0"
  ]);

  if (result.code === 0) {
    const wasmBin = clangInstance.FS.readFile("a.wasm", { encoding: "binary" });
    postMessage({ type: "compiled", wasmBin }, [wasmBin.buffer]);
  } else {
    postMessage({ type: "error", message: clangInstance.stderr });
  }
};
