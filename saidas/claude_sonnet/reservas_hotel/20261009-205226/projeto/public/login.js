document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;
  const errorDiv = document.getElementById('errorMessage');
  
  errorDiv.textContent = '';
  errorDiv.classList.remove('show');
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, senha })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      if (data.user.tipo === 'gerente') {
        window.location.href = '/gerente';
      } else {
        window.location.href = '/hospede';
      }
    } else {
      errorDiv.textContent = data.error;
      errorDiv.classList.add('show');
    }
  } catch (error) {
    errorDiv.textContent = 'Erro ao fazer login. Tente novamente.';
    errorDiv.classList.add('show');
  }
});
