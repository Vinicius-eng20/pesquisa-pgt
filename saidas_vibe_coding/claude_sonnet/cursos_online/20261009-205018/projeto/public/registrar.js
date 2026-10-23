document.getElementById('registrarForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const nome = document.getElementById('nome').value;
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;
  const mensagem = document.getElementById('mensagem');

  try {
    const response = await fetch('/api/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha })
    });

    const data = await response.json();

    if (response.ok) {
      mensagem.className = 'mensagem sucesso';
      mensagem.textContent = 'Conta criada com sucesso! Redirecionando...';
      
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    } else {
      mensagem.className = 'mensagem erro';
      mensagem.textContent = data.erro;
    }
  } catch (erro) {
    mensagem.className = 'mensagem erro';
    mensagem.textContent = 'Erro ao criar conta';
  }
});
