document.getElementById('cadastroForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const nome = document.getElementById('nome').value;
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;
  const confirmarSenha = document.getElementById('confirmarSenha').value;
  const errorDiv = document.getElementById('errorMessage');
  
  errorDiv.textContent = '';
  errorDiv.classList.remove('show');
  
  if (senha !== confirmarSenha) {
    errorDiv.textContent = 'As senhas não coincidem';
    errorDiv.classList.add('show');
    return;
  }
  
  if (senha.length < 6) {
    errorDiv.textContent = 'A senha deve ter no mínimo 6 caracteres';
    errorDiv.classList.add('show');
    return;
  }
  
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nome, email, senha })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      window.location.href = '/hospede';
    } else {
      errorDiv.textContent = data.error;
      errorDiv.classList.add('show');
    }
  } catch (error) {
    errorDiv.textContent = 'Erro ao criar conta. Tente novamente.';
    errorDiv.classList.add('show');
  }
});
