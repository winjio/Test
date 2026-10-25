let currentUser = JSON.parse(localStorage.getItem('crorebet_user'));

// Page load hote hi check karo ki user login hai ya nahi
document.addEventListener('DOMContentLoaded', () => {
  if (currentUser) {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    updateProfileUI();
  }
});

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  if (tab === 'login') {
    document.getElementById('btn-login').classList.add('active');
    document.getElementById('loginForm').classList.add('active');
  } else {
    document.getElementById('btn-reg').classList.add('active');
    document.getElementById('registerForm').classList.add('active');
  }
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPass').value;
  if (email && pass.length >= 4) {
    currentUser = { name: email.split('@')[0], email: email, balance: 1000, transactions: [], refCode: 'CB' + Math.floor(Math.random()*9000+1000) };
    saveUserData(); loginSuccess();
  } else {
    document.getElementById('authMsg').textContent = 'Invalid credentials.';
  }
}

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const pass = document.getElementById('regPass').value;
  if (name && email && pass.length >= 4) {
    currentUser = { name: name, email: email, balance: 1000, transactions: [], refCode: 'CB' + Math.floor(Math.random()*9000+1000) };
    saveUserData(); loginSuccess();
  } else {
    document.getElementById('authMsg').textContent = 'Fill all fields properly.';
  }
}

function loginSuccess() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  updateProfileUI();
}

function updateProfileUI() {
  if (currentUser) {
    document.getElementById('userNameDisplay').textContent = currentUser.name;
    document.getElementById('userBalanceDisplay').textContent = '₹ ' + currentUser.balance.toLocaleString();
  }
}

function saveUserData() { localStorage.setItem('crorebet_user', JSON.stringify(currentUser)); }
function logout() { localStorage.removeItem('crorebet_user'); location.reload(); }
