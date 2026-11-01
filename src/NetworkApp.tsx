import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { ArrowUpRight, ChevronRight, Coins, Command, Copy, FileText, FolderOpen, LockKeyhole, LogOut, Mail, MessageCircle, Mic, Plus, RefreshCw, Send, Settings2, ShieldCheck, Users, X } from "lucide-react";

const URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const PUBLIC_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
const db = URL && PUBLIC_KEY ? createClient(URL, PUBLIC_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;

const MODELS = [
  { id: "liquid/lfm-2.5-2.6b:free", name: "AGOORA 2.0", info: "Liquid AI · LFM2.5-2.6B" },
  { id: "thinkingmachines/inkling-small:free", name: "MATRIX AI 1.0", info: "Thinking Machines · Inkling Small" }
] as const;

const navItems = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "agents", label: "Agents", icon: Users },
  { id: "plugins", label: "Plugins", icon: Mail },
  { id: "permissions", label: "Permissions", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings2 }
] as const;

type Agent = { id: string; name: string; purpose: string; personality: string };
type Message = { id: string; role: "user" | "assistant"; content: string };
type Page = "chat" | "agents" | "settings" | "plugins" | "permissions" | "credits";

function localKey(uid: string, part: string) { return "matrix." + uid + "." + part; }
function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function renderInline(text: string, prefix: string): ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    const key = prefix + i;
    if (part.startsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`")) return <code className="inline-code" key={key}>{part.slice(1, -1)}</code>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}

function FormattedMessage({ content }: { content: string }) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim(); i++; const code: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push(<pre className="code-block" key={"code"+blocks.length}><div className="code-language">{language || "CODE"}</div><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const children = renderInline(heading[2], "h"+blocks.length), level = heading[1].length;
      blocks.push(level === 1 ? <h2 key={"h"+blocks.length}>{children}</h2> : level === 2 ? <h3 key={"h"+blocks.length}>{children}</h3> : <h4 key={"h"+blocks.length}>{children}</h4>);
      i++; continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*+]\s+/, ""));
      blocks.push(<ul key={"ul"+blocks.length}>{items.map((x,n)=><li key={n}>{renderInline(x,"ul"+n)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(<ol key={"ol"+blocks.length}>{items.map((x,n)=><li key={n}>{renderInline(x,"ol"+n)}</li>)}</ol>);
      continue;
    }
    const paragraph: string[] = [line.trim()]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s+/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i]) && !lines[i].trim().startsWith("```")) paragraph.push(lines[i++].trim());
    blocks.push(<p key={"p"+blocks.length}>{paragraph.map((x,n)=><Fragment key={n}>{n ? " " : ""}{renderInline(x,"p"+blocks.length+n)}</Fragment>)}</p>);
  }
  return <div className="message-content">{blocks}</div>;
}

function initials(value: string) { return value.split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase() ?? "").join("") || "AI"; }

export default function NetworkApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const resetRequestInFlight = useRef(false);
  const [authError, setAuthError] = useState("");
  const [authNote, setAuthNote] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [page, setPage] = useState<Page>("chat");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsError, setCreditsError] = useState("");
  const [guestRemaining, setGuestRemaining] = useState(10);
  const [localDataReady, setLocalDataReady] = useState(false);
  const [model, setModel] = useState<string>(MODELS[0].id);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [chatError, setChatError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentPurpose, setAgentPurpose] = useState("");
  const [agentPersonality, setAgentPersonality] = useState("Calm and helpful");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState("");
  const [gmailBusy, setGmailBusy] = useState(false);
  const [gmailError, setGmailError] = useState("");
  const [gmailNotice, setGmailNotice] = useState("");
  const [mailTo, setMailTo] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");

  useEffect(() => {
    if (!db) { setAuthReady(true); return; }
    let active = true;
    void db.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setAuthReady(true); } });
    const { data } = db.auth.onAuthStateChange((_event, current) => setSession(current));
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!db) return;
    let active = true;
    const handleRecoveryUrl = async (rawUrl: string) => {
      try {
        const incoming = new globalThis.URL(rawUrl);
        const params = new URLSearchParams(incoming.hash.replace(/^#/, ""));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");
        if (type !== "recovery" || !accessToken || !refreshToken) return;
        const { error } = await db.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) throw error;
        if (active) {
          setRecoveryMode(true);
          setForgotOpen(false);
          setAuthError("");
          setAuthNote("");
        }
      } catch (error) {
        if (active) setAuthError(error instanceof Error ? error.message : "This password reset link could not be verified. Request a new one.");
      }
    };
    let unlisten: (() => void) | undefined;
    void onOpenUrl(urls => { for (const url of urls) void handleRecoveryUrl(url); }).then(fn => {
      if (active) unlisten = fn;
      else fn();
    }).catch(() => undefined);
    void getCurrent().then(urls => {
      if (active && urls) for (const url of urls) void handleRecoveryUrl(url);
    }).catch(() => undefined);
    return () => { active = false; unlisten?.(); };
  }, []);

  useEffect(() => {
    if (!session) { setLocalDataReady(false); setAgents([]); setMessages({}); setCredits(null); setSelectedId(null); return; }
    setLocalDataReady(false);
    const id = session.user.id;
    const savedAgents = read<Agent[]>(localKey(id, "agents"), []);
    setAgents(savedAgents);
    setMessages(read(localKey(id, "messages"), {}));
    setModel(read(localKey(id, "model"), MODELS[0].id));
    if (session.user.is_anonymous) {
      setCredits(null); setCreditsError("");
      setGuestRemaining(read(localKey(id, "guest_remaining"), 10));
      if (savedAgents.length === 0) {
        const starter: Agent = { id: crypto.randomUUID(), name: "MATRIX Assistant", purpose: "Your guest AI assistant.", personality: "Calm and helpful" };
        setAgents([starter]); setSelectedId(starter.id);
      }
      setLocalDataReady(true);
      return;
    }
    setLocalDataReady(true);
    let active = true;
    void db?.from("credit_accounts").select("balance").eq("user_id", id).single().then(({ data, error }) => {
      if (!active) return;
      if (error || !data) { setCreditsError("Your credit account is not ready. Verify your email and try again."); setCredits(null); }
      else { setCreditsError(""); setCredits(data.balance); }
    });
    return () => { active = false; };
  }, [session]);

  useEffect(() => { if (session && localDataReady) localStorage.setItem(localKey(session.user.id, "agents"), JSON.stringify(agents)); }, [agents, session, localDataReady]);
  useEffect(() => { if (session && localDataReady) localStorage.setItem(localKey(session.user.id, "messages"), JSON.stringify(messages)); }, [messages, session, localDataReady]);
  useEffect(() => { if (session && localDataReady) localStorage.setItem(localKey(session.user.id, "model"), JSON.stringify(model)); }, [model, session, localDataReady]);
  useEffect(() => { if (session?.user.is_anonymous && localDataReady) localStorage.setItem(localKey(session.user.id, "guest_remaining"), JSON.stringify(guestRemaining)); }, [guestRemaining, session, localDataReady]);


  useEffect(() => {
    if (!session || session.user.is_anonymous || page !== "plugins" || !db) return;
    let active = true;
    void db.functions.invoke<{ connected: boolean; email: string | null }>("gmail-plugin", { body: { action: "status" } }).then(({ data, error }) => {
      if (!active) return;
      if (error) setGmailError("Could not check Gmail connection status.");
      else { setGmailConnected(!!data?.connected); setGmailEmail(data?.email || ""); }
    });
    return () => { active = false; };
  }, [session, page]);

  async function connectGmail() {
    if (!db || gmailBusy) return;
    setGmailBusy(true); setGmailError(""); setGmailNotice("");
    try {
      const { data, error } = await db.functions.invoke<{ url: string }>("gmail-plugin", { body: { action: "start" } });
      if (error || !data?.url) throw new Error("Could not start Google authorization.");
      await openUrl(data.url);
      setGmailNotice("Google opened in your browser. Approve Gmail access there, then return and refresh status.");
    } catch (error) { setGmailError(error instanceof Error ? error.message : "Could not open Google sign-in."); }
    finally { setGmailBusy(false); }
  }

  async function refreshGmailStatus() {
    if (!db) return;
    setGmailError(""); setGmailNotice("");
    const { data, error } = await db.functions.invoke<{ connected: boolean; email: string | null }>("gmail-plugin", { body: { action: "status" } });
    if (error) setGmailError("Could not check Gmail connection status.");
    else { setGmailConnected(!!data?.connected); setGmailEmail(data?.email || ""); setGmailNotice(data?.connected ? "Gmail connection verified." : "Gmail is not connected yet."); }
  }

  async function disconnectGmail() {
    if (!db || gmailBusy) return;
    setGmailBusy(true); setGmailError(""); setGmailNotice("");
    try {
      const { data, error } = await db.functions.invoke<{ disconnected: boolean; error?: string }>("gmail-plugin", { body: { action: "disconnect" } });
      if (error || !data?.disconnected) throw new Error(data?.error || "Could not disconnect Gmail.");
      setGmailConnected(false); setGmailEmail(""); setGmailNotice("Gmail has been disconnected.");
    } catch (error) { setGmailError(error instanceof Error ? error.message : "Could not disconnect Gmail."); }
    finally { setGmailBusy(false); }
  }

  async function sendApprovedEmail() {
    if (!db || gmailBusy) return;
    const approved = window.confirm("Send this email from " + gmailEmail + "?\n\nTo: " + mailTo + "\nSubject: " + mailSubject + "\n\n" + mailBody);
    if (!approved) return;
    setGmailBusy(true); setGmailError(""); setGmailNotice("");
    try {
      const { data, error } = await db.functions.invoke<{ sent: boolean; error?: string }>("gmail-plugin", {
        body: { action: "send", approved: true, to: mailTo, subject: mailSubject, body: mailBody }
      });
      if (error || !data?.sent) throw new Error(data?.error || "Gmail could not send the email.");
      setMailTo(""); setMailSubject(""); setMailBody(""); setGmailNotice("Email sent successfully.");
    } catch (error) { setGmailError(error instanceof Error ? error.message : "Gmail send failed."); }
    finally { setGmailBusy(false); }
  }

  const activeAgent = agents.find(a => a.id === selectedId) ?? agents[0] ?? null;
  const chat = activeAgent ? messages[activeAgent.id] ?? [] : [];
  const selectedModel = MODELS.find(m => m.id === model) ?? MODELS[0];

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) return;
    setAuthBusy(true); setAuthError(""); setAuthNote("");
    try {
      if (mode === "sign_up") {
        if (displayName.trim().length < 2) throw new Error("Enter a display name with at least two characters.");
        const { data, error } = await db.auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName.trim().slice(0, 48) } } });
        if (error) throw error;
        if (data.session) setSession(data.session);
        else setAuthNote("Account created. Check your email to verify it. Your 300 CRD starter grant is created once for this account.");
      } else {
        const { data, error } = await db.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setSession(data.session);
      }
    } catch (error) { setAuthError(error instanceof Error ? error.message : "Could not sign in."); }
    finally { setAuthBusy(false); }
  }

  async function sendPasswordReset() {
    if (!db || resetRequestInFlight.current || !email.trim()) return;
    resetRequestInFlight.current = true;
    setAuthBusy(true); setAuthError(""); setAuthNote("");
    try {
      const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "com.matrixlabs.desktop://auth/reset-password"
      });
      if (error) throw error;
      setAuthNote("If an account exists for that email, a password reset link has been sent. Open it on this device to continue in MATRIX LABS.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not send the password reset email.");
    } finally {
      resetRequestInFlight.current = false;
      setAuthBusy(false);
    }
  }

  async function saveNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || authBusy) return;
    if (newPassword.length < 8) { setAuthError("Use at least 8 characters for your new password."); return; }
    if (newPassword !== confirmNewPassword) { setAuthError("The passwords do not match."); return; }
    setAuthBusy(true); setAuthError(""); setAuthNote("");
    try {
      const { error } = await db.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await db.auth.signOut();
      setRecoveryMode(false); setMode("sign_in"); setForgotOpen(false);
      setPassword(""); setNewPassword(""); setConfirmNewPassword("");
      setAuthNote("Password updated. Sign in with your new password.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not update your password. Request a fresh reset link.");
    } finally { setAuthBusy(false); }
  }

  async function signOut() { await db?.auth.signOut(); setPage("chat"); }
  async function continueAsGuest() {
    if (!db || authBusy) return;
    setAuthBusy(true); setAuthError("");
    try { const { data, error } = await db.auth.signInAnonymously(); if (error) throw error; if (data.session) setSession(data.session); }
    catch (error) { setAuthError(error instanceof Error ? error.message : "Guest access is unavailable."); }
    finally { setAuthBusy(false); }
  }

  function createAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agentName.trim()) return;
    const item = { id: crypto.randomUUID(), name: agentName.trim(), purpose: agentPurpose.trim() || "A personal assistant for everyday tasks.", personality: agentPersonality };
    setAgents(current => [...current, item]);
    setSelectedId(item.id); setCreateOpen(false); setPage("chat");
    setAgentName(""); setAgentPurpose("");
  }

  async function refreshCredits() {
    if (!db || !session) return;
    const { data } = await db.from("credit_accounts").select("balance").eq("user_id", session.user.id).single();
    if (data) setCredits(data.balance);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeAgent || !db || !session || sending) return;
    const isGuest = session.user.is_anonymous;
    if (!isGuest && (!credits || credits < 1)) { setChatError("You have no MATRIX Credits remaining."); return; }
    if (isGuest && guestRemaining < 1) { setChatError("Guest limit reached. Create an account for more messages."); return; }
    const id = crypto.randomUUID();
    const history = [...chat.map(m => ({ role: m.role, content: m.content })), { role: "user", content: text }].slice(-24);
    const systemPrompt = [
      "You are " + activeAgent.name + ", a personal assistant in MATRIX LABS.",
      "Personality: " + activeAgent.personality + ".",
      "Purpose: " + activeAgent.purpose,
      "Chat-only release: no tools, file access, email access, or shell access.",
      "Never claim to have changed the computer or performed an external action."
    ].join("\n");
    setMessages(current => ({ ...current, [activeAgent.id]: [...(current[activeAgent.id] ?? []), { id, role: "user", content: text }] }));
    setDraft(""); setChatError(""); setSending(true);
    try {
      const { data, error } = await db.functions.invoke<{ content: string; balance: number | null; guestRemaining?: number | null }>("matrix-chat", {
        body: { requestId: crypto.randomUUID(), modelId: model, systemPrompt, messages: history }
      });
      if (error) {
        let message = error.message;
        if (error.context instanceof Response) {
          try { const body = await error.context.json() as { error?: string }; if (body.error) message = body.error; } catch { /* keep SDK error */ }
        }
        throw new Error(message || "MATRIX AI request failed.");
      }
      if (!data || typeof data.content !== "string") throw new Error("MATRIX AI returned an invalid response.");
      if (isGuest) { if (typeof data.guestRemaining === "number") setGuestRemaining(data.guestRemaining); }
      else { if (typeof data.balance !== "number") throw new Error("Invalid credit balance."); setCredits(data.balance); }
      setMessages(current => ({ ...current, [activeAgent.id]: [...(current[activeAgent.id] ?? []), { id: id + "-reply", role: "assistant", content: data.content }] }));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : String(error));
      if (!isGuest) await refreshCredits();
    } finally { setSending(false); }
  }

  async function regenerate(messageId: string) {
    if (!activeAgent || !db || !session || sending || regeneratingId) return;
    const index = chat.findIndex(m => m.id === messageId);
    if (index < 1 || chat[index].role !== "assistant" || chat[index - 1].role !== "user") return;
    const isGuest = session.user.is_anonymous;
    if (!isGuest && (!credits || credits < 1)) { setChatError("You have no MATRIX Credits remaining."); return; }
    if (isGuest && guestRemaining < 1) { setChatError("Guest limit reached. Create an account for more messages."); return; }
    const priorMessages = chat.slice(0, index).map(m => ({ role: m.role, content: m.content })).slice(-24);
    const systemPrompt = [
      "You are " + activeAgent.name + ", a personal assistant in MATRIX LABS.",
      "Personality: " + activeAgent.personality + ".",
      "Purpose: " + activeAgent.purpose,
      "Chat-only release: no tools, file access, email access, or shell access.",
      "Never claim to have changed the computer or performed an external action."
    ].join("\\n");
    setRegeneratingId(messageId); setChatError("");
    try {
      const { data, error } = await db.functions.invoke<{ content: string; balance: number | null; guestRemaining?: number | null }>("matrix-chat", {
        body: { requestId: crypto.randomUUID(), modelId: model, systemPrompt, messages: priorMessages }
      });
      if (error) {
        let message = error.message;
        if (error.context instanceof Response) {
          try { const body = await error.context.json() as { error?: string }; if (body.error) message = body.error; } catch { /* keep SDK error */ }
        }
        throw new Error(message || "MATRIX AI regeneration failed.");
      }
      if (!data || typeof data.content !== "string") throw new Error("MATRIX AI returned an invalid response.");
      if (isGuest) { if (typeof data.guestRemaining === "number") setGuestRemaining(data.guestRemaining); }
      else { if (typeof data.balance !== "number") throw new Error("Invalid credit balance."); setCredits(data.balance); }
      setMessages(current => {
        const list = [...(current[activeAgent.id] ?? [])];
        const target = list.findIndex(m => m.id === messageId);
        if (target >= 0) list[target] = { ...list[target], content: data.content };
        return { ...current, [activeAgent.id]: list };
      });
    } catch (error) {
      setChatError(error instanceof Error ? error.message : String(error));
      if (!isGuest) await refreshCredits();
    } finally { setRegeneratingId(null); }
  }

  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(current => current === message.id ? null : current), 1600);
    } catch { setChatError("Could not copy this response. Check clipboard permission."); }
  }

  function title(text: string, desc: string, action?: ReactNode) {
    return <div className="page-heading"><div><div className="eyebrow">MATRIX LABS</div><h1>{text}</h1><p>{desc}</p></div>{action}</div>;
  }
  const createButton = <button className="button primary" onClick={() => setCreateOpen(true)}><Plus size={13} /> Create agent</button>;

  if (!URL || !PUBLIC_KEY) return <div className="auth-shell"><section className="auth-card">
    <div className="brand auth-brand"><div className="brand-mark"><Command size={17} /></div><div><strong>MATRIX</strong><span>LABS</span></div></div>
    <div className="eyebrow">BACKEND SETUP</div><h1>Connect the MATRIX Network.</h1>
    <p>The project administrator must add the public backend URL and publishable key to the desktop build settings.</p>
    <div className="provider-key-note"><LockKeyhole size={13} /><span>The shared AI secret belongs in the server secret store only. It must never be placed in the app or repository.</span></div>
    <div className="auth-footnote">See docs/SUPABASE_SETUP.md for the project setup checklist.</div>
  </section></div>;

  if (!authReady) return <div className="auth-shell"><section className="auth-card auth-loading"><div className="brand-mark"><Command size={18} /></div><h2>Connecting MATRIX LABS…</h2><p>Restoring your secure session.</p></section></div>;

  if (recoveryMode) return <div className="auth-shell"><section className="auth-card">
    <div className="brand auth-brand"><div className="brand-mark"><Command size={17} /></div><div><strong>MATRIX</strong><span>LABS</span></div></div>
    <div className="eyebrow">ACCOUNT RECOVERY</div>
    <h1>Set a new password.</h1>
    <p>Your reset link is verified. Choose a new password for your MATRIX LABS account.</p>
    <form className="auth-form" onSubmit={saveNewPassword}>
      <label htmlFor="ml-new-password">New password</label>
      <input id="ml-new-password" className="field" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
      <label htmlFor="ml-confirm-password">Confirm new password</label>
      <input id="ml-confirm-password" className="field" type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
      {authError && <div className="provider-alert error-alert">{authError}</div>}
      <button className="button primary auth-submit" type="submit" disabled={authBusy || newPassword.length < 8 || confirmNewPassword.length < 8}>{authBusy ? "Updating password…" : "Update password"}</button>
    </form>
  </section></div>;

  if (!session) return <div className="auth-shell"><section className="auth-card">
    <div className="brand auth-brand"><div className="brand-mark"><Command size={17} /></div><div><strong>MATRIX</strong><span>LABS</span></div></div>
    <div className="eyebrow">MATRIX NETWORK</div>
    <h1>{forgotOpen ? "Reset your password." : mode === "sign_up" ? "Create your account." : "Welcome back."}</h1>
    <p>{forgotOpen ? "Enter your account email. We'll send you a secure reset link that opens MATRIX LABS." : mode === "sign_up" ? "Join MATRIX LABS and receive 300 starter MATRIX Credits." : "Sign in to continue your conversations."}</p>
    <form className="auth-form" onSubmit={forgotOpen ? (event) => { event.preventDefault(); void sendPasswordReset(); } : authenticate}>
      {!forgotOpen && mode === "sign_up" && <><label htmlFor="ml-name">Display name</label><input id="ml-name" className="field" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={48} autoComplete="name" required /></>}
      <label htmlFor="ml-email">Email</label><input id="ml-email" className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
      {!forgotOpen && <><label htmlFor="ml-password">Password</label><input id="ml-password" className="field" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} autoComplete={mode === "sign_up" ? "new-password" : "current-password"} required /></>}
      {authError && <div className="provider-alert error-alert">{authError}</div>}
      {authNote && <div className="provider-alert success-alert">{authNote}</div>}
      <button className="button primary auth-submit" type="submit" disabled={authBusy || !email.trim() || (!forgotOpen && password.length < 8) || (!forgotOpen && mode === "sign_up" && displayName.trim().length < 2)}>{authBusy ? "Please wait…" : forgotOpen ? "Send reset email" : mode === "sign_up" ? "Create account" : "Sign in"}</button>
    </form>
    {!forgotOpen && mode === "sign_in" && <button className="auth-switch forgot-link" type="button" onClick={() => { setForgotOpen(true); setAuthError(""); setAuthNote(""); }}>{ "Forgot your password?" }</button>}
    {forgotOpen && <button className="auth-switch forgot-link" type="button" onClick={() => { setForgotOpen(false); setAuthError(""); setAuthNote(""); }}>{ "Back to sign in" }</button>}
    {!forgotOpen && <><button className="button secondary auth-submit guest-submit" type="button" onClick={continueAsGuest} disabled={authBusy}>{authBusy ? "Starting guest session…" : "Continue as Guest"}</button>
    <div className="auth-footnote">Guest access: 10 messages per rolling 24 hours. No CRD required.</div>
    <button className="auth-switch" onClick={() => { setMode(mode === "sign_up" ? "sign_in" : "sign_up"); setAuthError(""); setAuthNote(""); }}>{mode === "sign_up" ? "Already have an account? Sign in" : "New to MATRIX LABS? Create an account"}</button>
    <div className="auth-footnote">Email verification is required. The 300 CRD welcome grant is issued once per account.</div></>}
  </section></div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Command size={17} /></div><div><strong>MATRIX</strong><span>LABS</span></div></div>
      <div className="workspace-switch"><div className="workspace-avatar">{initials(session.user.user_metadata?.display_name || session.user.email || "M")}</div><div><strong>{session.user.user_metadata?.display_name || "MATRIX member"}</strong><span>Personal workspace</span></div><ChevronRight size={11} /></div>
      <div className="nav-label">MESSAGES</div>
      <nav>{navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => setPage(item.id)}><Icon size={14} /><span>{item.label}</span>{item.id === "agents" && agents.length > 0 && <small>{agents.length}</small>}</button>; })}</nav>
      <div className="agent-sidebar-head"><div className="nav-label">YOUR AGENTS</div><button className="sidebar-add" onClick={() => setCreateOpen(true)} title="Create agent"><Plus size={11} /></button></div>
      <div className="sidebar-agent-list">{agents.map(agent => <button key={agent.id} className={page === "chat" && activeAgent?.id === agent.id ? "agent-nav active" : "agent-nav"} onClick={() => { setSelectedId(agent.id); setPage("chat"); }}><div className="tiny-avatar">{initials(agent.name)}</div><span>{agent.name}</span><i /></button>)}{agents.length === 0 && <div className="sidebar-empty">No conversations yet</div>}</div>
      <div className="sidebar-spacer" />
      {session.user.is_anonymous ? <div className="credit-mini guest-credit"><Users size={11} /><span>GUEST · {guestRemaining}/10 LEFT</span></div> : <button className="credit-mini" onClick={() => setPage("credits")}><Coins size={11} /><span>{credits === null ? "—" : credits.toLocaleString()} MATRIX CRD</span><ArrowUpRight size={10} /></button>}
      <div className="sidebar-profile"><div className="profile-circle">{initials(session.user.user_metadata?.display_name || session.user.email || "M")}</div><div><strong>{session.user.is_anonymous ? "Guest" : session.user.email}</strong><span>{session.user.is_anonymous ? "Guest session · V0.5.0" : "Signed in · V0.5.0"}</span></div><button onClick={signOut} title="Sign out"><LogOut size={13} /></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={11} /><strong>{page === "chat" ? activeAgent?.name ?? "Chat" : page === "credits" ? "MATRIX Credits" : page[0].toUpperCase() + page.slice(1)}</strong></div><div className="topbar-actions"><div className="local-mode"><i /> {session.user.is_anonymous ? "GUEST MODE" : "ACCOUNT CONNECTED"}</div>{session.user.is_anonymous ? <div className="top-credits"><Users size={12} /><strong>{guestRemaining}/10</strong><span>LEFT</span></div> : <button className="top-credits" onClick={() => setPage("credits")}><Coins size={12} /><strong>{credits ?? "—"}</strong><span>CRD</span></button>}</div></header>
      <div className={page === "chat" ? "page-content chat-content" : "page-content"}>
        {page === "agents" && <>
          {title("Your agents.", "Give each assistant its own name, purpose, and personality.", createButton)}
          {agents.length === 0 ? <div className="large-empty panel"><div className="empty-icon big"><Users size={24} /></div><h3>Your agent list is empty.</h3><p>Create an agent to start a conversation.</p>{createButton}</div> : <div className="agent-cards">{agents.map(agent => <article className="agent-card panel" key={agent.id}><div className="agent-card-top"><div className="avatar big-avatar">{initials(agent.name)}</div><span className="local-tag">LOCAL PROFILE</span></div><h3>{agent.name}</h3><div className="personality">{agent.personality}</div><p>{agent.purpose}</p><div className="agent-card-actions"><button className="button secondary" onClick={() => { setSelectedId(agent.id); setPage("chat"); }}><MessageCircle size={13} /> Open chat</button><button className="icon-button danger" onClick={() => { setAgents(list => list.filter(a => a.id !== agent.id)); setMessages(list => { const copy = {...list}; delete copy[agent.id]; return copy; }); if(selectedId === agent.id) setSelectedId(null); }} title="Delete agent"><X size={14} /></button></div></article>)}</div>}
        </>}
        {page === "chat" && (activeAgent ? <>
          <div className="chat-topline"><div className="chat-title-block"><div className="eyebrow">CONVERSATION</div><h1>{activeAgent.name}</h1><p>{activeAgent.personality}</p></div><div className="chat-top-actions"><select className="model-select" aria-label="Choose MATRIX model" value={model} onChange={e => setModel(e.target.value)}>{MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select><button className="icon-button" onClick={() => setPage("settings")} title="Settings"><Settings2 size={12} /></button></div></div>
          <div className="chat-layout chat-first-layout"><section className="chat-panel panel"><div className="chat-messages">{chat.length === 0 ? <div className="chat-welcome"><div className="avatar welcome-avatar">{initials(activeAgent.name)}</div><h3>Hi, I'm {activeAgent.name}.</h3><p>{activeAgent.purpose}</p><span>Powered by {selectedModel.name}. Choose a model above and say hello.</span></div> : chat.map(message => <div className={message.role === "user" ? "message-row user-message" : "message-row agent-message"} key={message.id}>{message.role !== "user" && <div className="message-avatar">{initials(activeAgent.name)}</div>}<div className="bubble"><span>{message.role === "user" ? "YOU" : activeAgent.name.toUpperCase()}</span><FormattedMessage content={message.content} />{message.role === "assistant" && <div className="message-actions"><button type="button" className="message-action" onClick={() => void copyMessage(message)} title="Copy response" aria-label="Copy response"><Copy size={12} /><span>{copiedId === message.id ? "Copied" : "Copy"}</span></button><button type="button" className="message-action" onClick={() => void regenerate(message.id)} disabled={sending || regeneratingId !== null} title="Regenerate response" aria-label="Regenerate response"><RefreshCw size={12} className={regeneratingId === message.id ? "spin" : ""} /><span>{regeneratingId === message.id ? "Regenerating…" : "Regenerate"}</span></button></div>}</div></div>)}{sending && <div className="typing-row"><div className="message-avatar">{initials(activeAgent.name)}</div><span>{activeAgent.name} is thinking…</span></div>}</div>
            {chatError && <div className="chat-error">{chatError}</div>}
            <form className="composer" onSubmit={send}><input value={draft} onChange={e => setDraft(e.target.value)} placeholder={session.user.is_anonymous && guestRemaining === 0 ? "Guest limit reached…" : !session.user.is_anonymous && credits === 0 ? "No MATRIX Credits remaining…" : "Message " + activeAgent.name + "…"} aria-label="Message" /><button className="voice-button" type="button" disabled title="Voice is planned for a later version"><Mic size={13} /></button><button className="send-button" type="submit" disabled={!draft.trim() || sending || (session.user.is_anonymous ? guestRemaining < 1 : credits === null || credits < 1)} aria-label="Send message"><Send size={13} /></button></form>
            <div className="chat-footnote"><LockKeyhole size={10} /> {selectedModel.name} · {session.user.is_anonymous ? guestRemaining + " guest messages remaining · 10 per 24 hours" : "1 CRD per successful reply · " + (credits ?? "—") + " CRD available"}</div>
          </section><aside className="agent-info panel"><div className="eyebrow">ABOUT THIS AGENT</div><div className="avatar profile-avatar">{initials(activeAgent.name)}</div><h3>{activeAgent.name}</h3><span className="personality-tag">{activeAgent.personality}</span><div className="info-divider" /><div className="eyebrow">PURPOSE</div><p>{activeAgent.purpose}</p><div className="info-divider" /><div className="permission-mini"><ShieldCheck size={12} /><span><strong>Device access off</strong><small>Chat only. No files, email, or Windows controls.</small></span></div></aside></div>
        </> : <div className="chat-empty panel"><h3>Your chat space is ready.</h3><p>Create an agent to start a conversation.</p><button className="button primary" onClick={() => setCreateOpen(true)}><Plus size={13} /> Create agent</button></div>)}
        {page === "settings" && <>
          {title("Your account.", "Manage your MATRIX account and choose a model.")}
          <div className="settings-grid">
            <section className="panel settings-panel"><div className="panel-head"><div><div className="eyebrow">ACCOUNT</div><h3>Personal workspace</h3></div><span className="connected-tag">{session.user.is_anonymous ? "GUEST" : "SIGNED IN"}</span></div><div className="account-details"><div className="account-avatar">{initials(session.user.user_metadata?.display_name || session.user.email || "M")}</div><div><strong>{session.user.is_anonymous ? "Guest session" : session.user.user_metadata?.display_name || "MATRIX member"}</strong><span>{session.user.is_anonymous ? "No email or password connected" : session.user.email}</span></div></div>{session.user.is_anonymous ? <div className="account-balance"><span className="eyebrow">GUEST QUOTA</span><strong>{guestRemaining} <small>/ 10 MESSAGES</small></strong><p>10 messages per rolling 24 hours. No CRD is issued or charged.</p></div> : <div className="account-balance"><span className="eyebrow">AVAILABLE BALANCE</span><strong>{credits ?? "—"} <small>CRD</small></strong><p>New accounts receive 300 CRD once. One successful AI response costs 1 CRD.</p></div>}{creditsError && <div className="provider-alert error-alert">{creditsError}</div>}<button className="button quiet" onClick={signOut}><LogOut size={12} /> Sign out</button></section>
            <section className="panel settings-panel"><div className="panel-head"><div><div className="eyebrow">MODEL PREFERENCE</div><h3>Choose your MATRIX model</h3></div><span className="local-tag">2 MODELS</span></div><div className="model-choice-list">{MODELS.map(m => <button key={m.id} className={model === m.id ? "model-choice selected" : "model-choice"} onClick={() => setModel(m.id)}><span className="model-choice-radio">{model === m.id ? "●" : "○"}</span><span className="model-choice-copy"><strong>{m.name}</strong><small>{m.info}</small><span>{m.id === MODELS[0].id ? "Lightweight everyday model." : "Larger model for more involved chats."}</span></span></button>)}</div><div className="settings-footnote">AGOORA's model publisher states prompts and outputs may be retained and used to improve models. Free routes can also be rate-limited. Never send passwords, secrets, or sensitive personal information.</div></section>
          </div>
          <div className="notice"><ShieldCheck size={13} /><span><strong>AI connection: Automatic.</strong> MATRIX LABS connects to its secured chat service without asking you for an API key. Your key stays on the server, and you can switch between AGOORA 2.0 and MATRIX AI 1.0 above. Only chat instructions and recent messages are sent to the selected model service.</span></div>
        </>}

        {page === "plugins" && <>
          {title("Your plugins.", "Connect external services only when you choose to.")}
          {session.user.is_anonymous ? <div className="notice muted-notice"><LockKeyhole size={13} /><span>Sign in to a MATRIX LABS account to connect plugins. Guest sessions cannot store external account connections.</span></div> : <>
            <section className="plugin-card panel">
              <div className="plugin-card-head"><div className="plugin-brand-icon"><Mail size={22} /></div><div className="plugin-card-title"><div className="eyebrow">EMAIL · GOOGLE</div><h3>Gmail</h3><p>Send email from your connected Gmail account, with your approval each time.</p></div><span className={gmailConnected ? "plugin-status connected" : "plugin-status"}>{gmailConnected ? "CONNECTED" : "NOT CONNECTED"}</span></div>
              {gmailConnected && <div className="plugin-account"><ShieldCheck size={13} /> Connected account: <strong>{gmailEmail}</strong></div>}
              <div className="plugin-scope"><ShieldCheck size={13} /><span><strong>Limited permission:</strong> MATRIX LABS requests permission to send email only. It does not request inbox reading access.</span></div>
              <div className="plugin-actions">{!gmailConnected ? <button className="button primary" onClick={() => void connectGmail()} disabled={gmailBusy}><ArrowUpRight size={13} /> {gmailBusy ? "Opening Google…" : "Connect Gmail"}</button> : <button className="button secondary" onClick={() => void disconnectGmail()} disabled={gmailBusy}>{gmailBusy ? "Disconnecting…" : "Disconnect"}</button>}<button className="button quiet" onClick={() => void refreshGmailStatus()} disabled={gmailBusy}>Refresh status</button></div>
              <p className="plugin-footnote">Connect opens Google's official sign-in page in your browser. MATRIX LABS never sees your Google password.</p>
            </section>
            {gmailConnected && <section className="panel email-compose"><div className="eyebrow">GMAIL COMPOSER</div><h3>Prepare an email</h3><p className="compose-note">Review the recipient, subject, and message. Nothing is sent until you explicitly approve it.</p>
              <form onSubmit={e => { e.preventDefault(); void sendApprovedEmail(); }}>
                <label htmlFor="gmail-to">To</label><input id="gmail-to" className="field" type="email" required maxLength={254} value={mailTo} onChange={e => setMailTo(e.target.value)} placeholder="recipient@example.com" />
                <label htmlFor="gmail-subject">Subject</label><input id="gmail-subject" className="field" required maxLength={200} value={mailSubject} onChange={e => setMailSubject(e.target.value)} placeholder="Email subject" />
                <label htmlFor="gmail-body">Message</label><textarea id="gmail-body" className="field" required maxLength={20000} rows={7} value={mailBody} onChange={e => setMailBody(e.target.value)} placeholder="Write your email…" />
                <div className="compose-actions"><span><LockKeyhole size={11} /> Confirmation required before sending</span><button className="button primary" type="submit" disabled={gmailBusy}>{gmailBusy ? "Sending…" : "Review & Send"}</button></div>
              </form>
            </section>}
          </>}
          {gmailError && <div className="provider-alert error-alert">{gmailError}</div>}
          {gmailNotice && <div className="provider-alert success-alert">{gmailNotice}</div>}
        </>}

        {page === "permissions" && <>
          {title("Your permissions.", "No computer access is enabled in this release.")}
          <section className="permission-status panel"><div className="permission-shield"><ShieldCheck size={21} /></div><div><div className="eyebrow">CURRENT DEVICE STATUS</div><h3>No system permissions granted</h3><p>Agents can chat, but cannot read files, use email, or control Windows.</p></div><span className="safe-tag">PROTECTED</span></section>
          <div className="permission-list">{[{ icon: FolderOpen, title: "Read files in a selected folder", detail: "Future access will be limited to folders you choose." }, { icon: FileText, title: "Create or edit documents", detail: "Changes will be previewed before anything is written." }, { icon: MessageCircle, title: "Create email drafts", detail: "Account connection and draft review will be required." }].map(row => { const Icon = row.icon; return <div className="permission-row panel" key={row.title}><div className="permission-icon"><Icon size={15} /></div><div className="permission-copy"><h4>{row.title}</h4><p>{row.detail}</p></div><span className="locked-state"><LockKeyhole size={11} /> PLANNED</span></div>; })}</div>
        </>}
        {page === "credits" && <>
          {title("MATRIX Credits.", "Your balance is stored on your account, not on this device.")}
          <section className="credits-banner"><div className="credits-emblem"><Coins size={21} /></div><div><div className="eyebrow">AVAILABLE BALANCE</div><div className="credits-total">{credits ?? "—"} <small>CRD</small></div><p>New accounts receive 300 CRD once. Each successful response costs 1 CRD.</p></div></section>
          <div className="notice muted-notice">Onboarding tasks do not add credits in this version. The server enforces the balance and prevents local edits.</div>
        </>}
        <footer className="page-footer"><span>MATRIX LABS <i>·</i> YOUR AI WORKSPACE</span><span>V0.4.0</span></footer>
      </div>
    </main>
    {createOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setCreateOpen(false); }}><form className="create-modal" onSubmit={createAgent}>
      <div className="modal-head"><div><div className="eyebrow">AGENT WORKSHOP</div><h2>Create an agent</h2><p>Start with an identity. Capabilities can be added later.</p></div><button type="button" className="icon-button" onClick={() => setCreateOpen(false)} aria-label="Close"><X size={15} /></button></div>
      <label htmlFor="agent-name">Agent name</label><input id="agent-name" className="field" value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="e.g. NOVA" maxLength={32} required autoFocus />
      <label htmlFor="agent-purpose">What is this agent for?</label><textarea id="agent-purpose" className="field" value={agentPurpose} onChange={e => setAgentPurpose(e.target.value)} placeholder="A study partner, project organizer, writing helper…" maxLength={180} rows={3} />
      <label htmlFor="agent-personality">Personality</label><select id="agent-personality" className="field" value={agentPersonality} onChange={e => setAgentPersonality(e.target.value)}><option>Calm and helpful</option><option>Focused and professional</option><option>Curious and creative</option><option>Friendly and encouraging</option><option>Concise and direct</option></select>
      <div className="modal-note"><ShieldCheck size={13} /><span>This profile is stored for your signed-in account on this device. Device permissions remain disabled.</span></div>
      <div className="modal-actions"><button type="button" className="button quiet" onClick={() => setCreateOpen(false)}>Cancel</button><button type="submit" className="button primary" disabled={!agentName.trim()}><Plus size={12} /> Create agent</button></div>
    </form></div>}
  </div>;
}
