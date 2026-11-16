// Encaminhador TCP minimo: 127.0.0.1:<porta> do container -> <host>:<porta>.
// Usado para que http://127.0.0.1:54321 (Supabase local) funcione igual no
// navegador do Windows e no codigo que roda no servidor (SSR do Lovable).
import net from "node:net";

const [portaLocal = "54321", host = "host.docker.internal", portaDestino = portaLocal] = process.argv.slice(2);

const servidor = net.createServer((cliente) => {
  const destino = net.connect(Number(portaDestino), host);
  cliente.pipe(destino).pipe(cliente);
  const fechar = () => { cliente.destroy(); destino.destroy(); };
  cliente.on("error", fechar);
  destino.on("error", (e) => {
    console.error(`[pgt-lowcode] Supabase local inacessivel em ${host}:${portaDestino} (${e.code}). O supabase start esta rodando?`);
    fechar();
  });
});

servidor.on("error", (e) => console.error(`[pgt-lowcode] encaminhador: ${e.message}`));
servidor.listen(Number(portaLocal), "127.0.0.1", () =>
  console.log(`[pgt-lowcode] 127.0.0.1:${portaLocal} -> ${host}:${portaDestino}`),
);
