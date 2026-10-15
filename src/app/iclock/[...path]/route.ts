// Other calls machines make (devicecmd, ping, ...) only need an acknowledgement.
const ok = () => new Response("OK", { headers: { "Content-Type": "text/plain" } });

export { ok as GET, ok as POST };
