// Utilitários
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro na requisição');
  }
  
  return response.json();
}

function showError(message) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-error';
  alert.textContent = message;
  document.body.insertBefore(alert, document.body.firstChild);
  setTimeout(() => alert.remove(), 5000);
}

function showSuccess(message) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-success';
  alert.textContent = message;
  document.body.insertBefore(alert, document.body.firstChild);
  setTimeout(() => alert.remove(), 5000);
}

function formatPrice(price) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(price);
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('pt-BR');
}
