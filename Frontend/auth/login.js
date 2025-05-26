const loginBtn = document.getElementById('loginBtn');

loginBtn.addEventListener('click', () => {
  // Replace with your actual backend worker URL that kicks off Google OAuth flow
  const backendAuthUrl = 'https://backend-worker.sethkeddy.workers.dev/auth/google';

  // Redirect the user to your backend’s OAuth start endpoint
  window.location.href = backendAuthUrl;
});
