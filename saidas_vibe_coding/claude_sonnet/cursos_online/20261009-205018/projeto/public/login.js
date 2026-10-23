document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;
  const mensagem = document.getElementById('mensagem');

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });

    const data = await response.json();

    if (response.ok) {
      mensagem.className = 'mensagem sucesso';
      mensagem.textContent = 'Login realizado com sucesso!';
      
      setTimeout(() => {
        if (data.usuario.tipo === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/aluno';
        }
      }, 500);
    } else {
      mensagem.className = 'mensagem erro';
      mensagem.textContent = data.erro;
    }
  } catch (erro) {
    mensagem.className = 'mensagem erro';
    mensagem.textContent = 'Erro ao fazer login';
  }
});
