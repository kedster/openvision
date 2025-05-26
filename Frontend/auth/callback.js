export async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    alert(`OAuth error: ${error}`);
    return;
  }

  if (!code) {
    alert('No authorization code found');
    return;
  }

  try {
    // Send the code to your backend worker to exchange for tokens & create a session
    const response = await fetch('https://backend-worker.sethkeddy.workers.dev/auth/google/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const err = await response.text();
      alert(`Login failed: ${err}`);
      return;
    }

    // Login succeeded — redirect to your app or homepage
    window.location.href = '/app.html'; // or wherever your main app is
  } catch (e) {
    alert(`Login error: ${e.message}`);
  }
}

// Immediately call on script load
handleOAuthCallback();
