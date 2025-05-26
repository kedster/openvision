// session.js
const session = {
  getToken() {
    return {
      access_token: localStorage.getItem("access_token"),
      id_token: localStorage.getItem("id_token"),
    };
  },

  isLoggedIn() {
    const token = this.getToken().id_token;
    if (!token) return false;

    try {
      const payload = this.parseJwt(token);
      const now = Math.floor(Date.now() / 1000);
      return payload.exp > now;
    } catch (e) {
      return false;
    }
  },

  parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
    return JSON.parse(jsonPayload);
  },

  getUserInfo() {
    const id_token = this.getToken().id_token;
    if (!id_token) return null;

    try {
      return this.parseJwt(id_token);
    } catch (e) {
      console.error("Failed to parse ID token", e);
      return null;
    }
  },

  logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("id_token");
    window.location.href = "/login.html";
  },

  ensureAuth() {
    if (!this.isLoggedIn()) {
      console.warn("Not logged in or token expired");
      this.logout();
    }
  }
};

// Example usage:
if (!session.isLoggedIn()) {
  console.log("User not logged in, redirecting to login.");
  window.location.href = "/login.html";
} else {
  const user = session.getUserInfo();
  console.log("Logged in as:", user.email);
}
