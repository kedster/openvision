export async function onRequest(context) {
  const { SUB_DB } = context.env;  // the binding declared in wrangler.toml

  // Example query to get all users
  const users = await SUB_DB.prepare("SELECT * FROM users").all();

  return new Response(JSON.stringify(users.results), {
    headers: { "Content-Type": "application/json" },
  });
}