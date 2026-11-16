// Reescreve os arquivos .env da COPIA DE TRABALHO para o Supabase local.
// O artefato original (montado somente leitura) nao e tocado; nesta copia, o
// .env do Supabase hospedado e preservado como .env.original, para conferencia.
//
// Regras (iguais para Bolt e Lovable, com base nas chaves que as plataformas geram):
//   *SUPABASE_URL                     -> http://127.0.0.1:54321
//   *ANON_KEY e *PUBLISHABLE_KEY      -> SUPABASE_ANON_KEY (chave anon local)
//   *SERVICE_ROLE_KEY                 -> SUPABASE_SERVICE_ROLE_KEY
//   *PROJECT_ID                       -> "local"
// As demais chaves ficam como estao.
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2] || process.cwd();
const plataforma = process.env.PLATAFORMA;
const URL_LOCAL = process.env.SUPABASE_URL_PUBLICA || "http://127.0.0.1:54321";
const anon = process.env.SUPABASE_ANON_KEY || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!anon) {
  console.error("[pgt-lowcode] SUPABASE_ANON_KEY vazio: rode pelo subir.ps1, que le as chaves do Supabase local.");
  process.exit(2);
}

function novoValor(chave) {
  if (/SUPABASE_URL$/.test(chave)) return URL_LOCAL;
  if (/(ANON_KEY|PUBLISHABLE_KEY)$/.test(chave)) return anon;
  if (/SERVICE_ROLE_KEY$/.test(chave)) return service || null;
  if (/SUPABASE_PROJECT_ID$/.test(chave)) return "local";
  return null;
}

function reescrever(texto) {
  const trocadas = [];
  const linhas = texto.split(/\r?\n/).map((linha) => {
    const m = linha.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!m) return linha;
    const valor = novoValor(m[1]);
    if (valor === null) return linha;
    trocadas.push(m[1]);
    return `${m[1]}="${valor}"`;
  });
  return { texto: linhas.join("\n"), trocadas };
}

// Chaves minimas por plataforma, caso o .env nao exista ou nao as traga.
const MINIMAS = {
  bolt: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
  lovable: [
    "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PROJECT_ID",
    "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PROJECT_ID",
  ],
};

const arquivos = fs.readdirSync(dir).filter((n) => /^\.env(\..+)?$/.test(n) && n !== ".env.original");
const envPrincipal = path.join(dir, ".env");
if (fs.existsSync(envPrincipal) && !fs.existsSync(path.join(dir, ".env.original"))) {
  fs.copyFileSync(envPrincipal, path.join(dir, ".env.original"));
}
if (!arquivos.includes(".env")) {
  fs.writeFileSync(envPrincipal, "");
  arquivos.push(".env");
}

for (const nome of arquivos) {
  const p = path.join(dir, nome);
  let { texto, trocadas } = reescrever(fs.readFileSync(p, "utf8"));
  if (nome === ".env") {
    const faltando = (MINIMAS[plataforma] || []).filter((k) => !trocadas.includes(k));
    for (const k of faltando) {
      texto += `${texto.endsWith("\n") || texto === "" ? "" : "\n"}${k}="${novoValor(k)}"\n`;
      trocadas.push(k);
    }
  }
  fs.writeFileSync(p, texto);
  console.log(`[pgt-lowcode] ${nome}: ${trocadas.length ? trocadas.join(", ") : "nada a trocar"} -> Supabase local`);
}
