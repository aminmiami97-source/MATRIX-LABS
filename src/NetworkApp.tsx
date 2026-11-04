import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ArrowUpRight, ChevronRight, Coins, Command, Copy, FileText, FolderOpen, Home, LockKeyhole, LogOut, Mail, MessageCircle, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, RefreshCw, Send, Settings2, ShieldCheck, Users, X } from "lucide-react";

const URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const PUBLIC_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
const APP_VERSION = "8.0.1";

const db = URL && PUBLIC_KEY ? createClient(URL, PUBLIC_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;

const MODELS = [
  { id: "liquid/lfm-2.5-2.6b:free", name: "AGOORA 2.0", info: "Liquid AI · LFM2.5-2.6B" },
  { id: "thinkingmachines/inkling-small:free", name: "MATRIX AI 1.0", info: "Thinking Machines · Inkling Small" }
] as const;

const navItems = [
  { id: "home", label: "Overview", icon: Home },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "agents", label: "Workspace", icon: Users },
  { id: "plugins", label: "Plugins", icon: Mail },
  { id: "permissions", label: "Permissions", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings2 }
] as const;

type Agent = { id: string; name: string; purpose: string; personality: string };
type EmailDraft = { to: string; subject: string; body: string };
type Attachment = { id: string; file: File; extractedText: string };
type Message = { id: string; role: "user" | "assistant"; content: string; emailDraft?: EmailDraft };
type Page = "home" | "chat" | "agents" | "settings" | "plugins" | "permissions" | "credits";

function localKey(uid: string, part: string) { return "matrix." + uid + "." + part; }
function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be unavailable or full; keep the app usable in memory. */ }
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
      blocks.push(<pre className="code-block" key={"code"+blocks.length}><div className="code-block-head"><div className="code-language">{language || "CODE"}</div><button type="button" className="code-copy" onClick={async () => { try { await navigator.clipboard.writeText(code.join("\n")); } catch { /* Clipboard access may be unavailable. */ } }} title="Copy code">Copy</button></div><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const children = renderInline(heading[2], "h"+blocks.length), level = heading[1].length;
      blocks.push(level === 1 ? <h2 key={"h"+blocks.length}>{children}</h2> : level === 2 ? <h3 key={"h"+blocks.length}>{children}</h3> : <h4 key={"h"+blocks.length}>{children}</h4>);
      i++; continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push(<blockquote className="message-quote" key={"quote"+blocks.length}>{quote.map((x,n)=><p key={n}>{renderInline(x,"quote"+n)}</p>)}</blockquote>);
      continue;
    }
    if (/^\s*[-*_]{3,}\s*$/.test(line)) { blocks.push(<hr className="message-rule" key={"hr"+blocks.length} />); i++; continue; }
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

  const [page, setPage] = useState<Page>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => read("matrix.ui.sidebarCollapsed", false));
  const [agentPanelCollapsed, setAgentPanelCollapsed] = useState(() => read("matrix.ui.agentPanelCollapsed", false));
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsError, setCreditsError] = useState("");
  const [guestRemaining, setGuestRemaining] = useState(10);
  const [localDataReady, setLocalDataReady] = useState(false);
  const [model, setModel] = useState<string>(MODELS[0].id);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [chatError, setChatError] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
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
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; notes: string } | null>(null);
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateProgressLabel, setUpdateProgressLabel] = useState("");

  async function checkForUpdates(silent = false) {
    if (updateChecking || updateDownloading) return;
    setUpdateChecking(true);
    setUpdateMessage("");
    try {
      const update = await check();
      if (!update) {
        setUpdateInfo(null);
        setUpdateMessage("You're using the latest version (v" + APP_VERSION + ").");
        return;
      }
      setUpdateInfo({ version: update.version, notes: (update.body || "A newer version of MATRIX LABS is available.").slice(0, 1200) });
      setUpdateDismissed(false);
      setUpdateMessage("Version " + update.version + " is ready to install.");
    } catch (error) {
      if (!silent) setUpdateMessage(error instanceof Error ? error.message : "Could not check for updates.");
    } finally {
      setUpdateChecking(false);
    }
  }

  async function installUpdate() {
    if (updateDownloading) return;
    setUpdateDownloading(true);
    setUpdateProgress(0);
    setUpdateProgressLabel("Preparing secure update…");
    setUpdateMessage("");
    try {
      const update = await check();
      if (!update) {
        setUpdateInfo(null);
        setUpdateMessage("You're already using the latest version.");
        setUpdateDownloading(false);
        setUpdateProgressLabel("");
        return;
      }
      setUpdateInfo({ version: update.version, notes: (update.body || "MATRIX LABS update").slice(0, 1200) });
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall(event => {
        if (event.event === "Started") {
          total = event.data.contentLength || 0;
          downloaded = 0;
          setUpdateProgress(0);
          setUpdateProgressLabel("Downloading update…");
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setUpdateProgress(total > 0 ? Math.min(100, downloaded / total * 100) : 0);
        } else if (event.event === "Finished") {
          setUpdateProgress(100);
          setUpdateProgressLabel("Download complete. Installing…");
        }
      });
      setUpdateProgress(100);
      setUpdateProgressLabel("Installed. Restarting MATRIX LABS…");
      try {
        await relaunch();
      } catch (error) {
        const detail = error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : error && typeof error === "object" && "message" in error
              ? String((error as { message: unknown }).message)
              : String(error);
        setUpdateMessage("Update installed, but MATRIX LABS could not restart automatically: " + detail);
        setUpdateProgressLabel("Update installed. Please close and reopen MATRIX LABS.");
        setUpdateDownloading(false);
      }
    } catch (error) {
      const detail = error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : error && typeof error === "object" && "message" in error
            ? String((error as { message: unknown }).message)
            : String(error);
      setUpdateMessage("Update installation failed: " + detail);
      setUpdateProgressLabel("");
      setUpdateDownloading(false);
    }
  }

  useEffect(() => { void checkForUpdates(true); }, []);

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
    const handledUrls = new Set<string>();
    const handleRecoveryUrl = async (rawUrl: string) => {
      if (handledUrls.has(rawUrl)) return;
      handledUrls.add(rawUrl);
      try {
        const incoming = new globalThis.URL(rawUrl);
        const params = new URLSearchParams(incoming.hash.replace(/^#/, ""));
        const type = incoming.searchParams.get("type") || params.get("type");
        const authError = incoming.searchParams.get("error_description") || params.get("error_description");
        if (authError) throw new Error(authError.replace(/\+/g, " "));

        // Supabase's default PKCE flow returns a one-time code in the query string.
        const code = incoming.searchParams.get("code");
        if (code) {
          const { error } = await db.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          // Also accept token-hash callbacks for projects using the implicit flow.
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (!accessToken || !refreshToken) return;
          const { error } = await db.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        }

        if (active) {
          if (type === "recovery") {
            setRecoveryMode(true);
            setForgotOpen(false);
            setAuthNote("");
          } else {
            setRecoveryMode(false);
            setForgotOpen(false);
            setAuthNote("Google sign-in successful. Welcome to MATRIX LABS.");
          }
          setAuthError("");
        }
      } catch (error) {
        if (active) setAuthError(error instanceof Error ? error.message : "This authentication link could not be verified. Try signing in again.");
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

  useEffect(() => { writeLocal("matrix.ui.sidebarCollapsed", sidebarCollapsed); }, [sidebarCollapsed]);
  useEffect(() => { writeLocal("matrix.ui.agentPanelCollapsed", agentPanelCollapsed); }, [agentPanelCollapsed]);
  useEffect(() => { if (session && localDataReady) writeLocal(localKey(session.user.id, "agents"), agents); }, [agents, session, localDataReady]);
  useEffect(() => { if (session && localDataReady) writeLocal(localKey(session.user.id, "messages"), messages); }, [messages, session, localDataReady]);
  useEffect(() => { if (session && localDataReady) writeLocal(localKey(session.user.id, "model"), model); }, [model, session, localDataReady]);
  useEffect(() => { if (session?.user.is_anonymous && localDataReady) writeLocal(localKey(session.user.id, "guest_remaining"), guestRemaining); }, [guestRemaining, session, localDataReady]);


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

  async function sendChatEmailDraft(draftEmail: EmailDraft) {
    if (!db || gmailBusy) return;
    if (!gmailConnected) {
      const { data, error } = await db.functions.invoke<{ connected: boolean; email: string | null }>("gmail-plugin", { body: { action: "status" } });
      if (error || !data?.connected) { setChatError("Connect Gmail in Plugins before sending this draft."); setPage("plugins"); return; }
      setGmailConnected(true); setGmailEmail(data.email || "");
    }
    const confirmed = window.confirm("Send this email from your connected Gmail account?\n\nTo: " + draftEmail.to + "\nSubject: " + draftEmail.subject + "\n\n" + draftEmail.body);
    if (!confirmed) return;
    setGmailBusy(true); setChatError("");
    try {
      const { data, error } = await db.functions.invoke<{ sent: boolean; error?: string }>("gmail-plugin", { body: { action: "send", approved: true, to: draftEmail.to, subject: draftEmail.subject, body: draftEmail.body } });
      if (error || !data?.sent) throw new Error(data?.error || "Gmail could not send the email.");
      setMessages(current => Object.fromEntries(Object.entries(current).map(([agentId, list]) => [agentId, list.map(m => m.emailDraft === draftEmail ? { ...m, content: m.content + "\n\n**Email sent successfully.**", emailDraft: undefined } : m)])));
    } catch (error) { setChatError(error instanceof Error ? error.message : "Gmail send failed."); }
    finally { setGmailBusy(false); }
  }

  const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

  async function addAttachments(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    const valid: Attachment[] = [];
    let textBudget = Math.max(0, 9000 - attachments.reduce((sum, item) => sum + item.extractedText.length, 0));
    for (const file of incoming) {
      if (file.size > MAX_ATTACHMENT_BYTES) { setChatError(file.name + " exceeds the 5 MB per-file limit."); continue; }
      if (attachments.length + valid.length >= 8) { setChatError("You can attach up to 8 files per message."); break; }
      let extractedText = "";
      const extension = file.name.toLowerCase().split(".").pop() || "";
      const textLike = file.type.startsWith("text/") || ["application/json", "application/xml", "text/csv"].includes(file.type) || ["txt", "md", "csv", "json", "xml", "html", "css", "js", "ts", "log"].includes(extension);
      if (textLike) {
        try { extractedText = (await file.text()).slice(0, Math.min(5000, textBudget)); textBudget -= extractedText.length; }
        catch { extractedText = ""; }
      }
      valid.push({ id: crypto.randomUUID(), file, extractedText });
    }
    if (valid.length) setAttachments(current => [...current, ...valid]);
    if (attachmentInput.current) attachmentInput.current.value = "";
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
  useEffect(() => { const node = chatScrollRef.current; if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" }); }, [chat, sending, regeneratingId]);
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

  async function signInWithGoogle() {
    if (!db || authBusy) return;
    setAuthBusy(true); setAuthError(""); setAuthNote("");
    try {
      const { data, error } = await db.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "com.matrixlabs.desktop://auth/callback",
          skipBrowserRedirect: true,
          queryParams: { prompt: "select_account" }
        }
      });
      if (error) throw error;
      if (!data.url) throw new Error("Google sign-in did not return an authorization URL.");
      await openUrl(data.url);
      setAuthNote("Google opened in your browser. Finish signing in there; MATRIX LABS will open automatically.");
    } catch (error) {
      console.error("MATRIX LABS Google sign-in failed:", error);
      let detail = "Unknown error";
      if (error instanceof Error) detail = error.message;
      else if (typeof error === "string") detail = error;
      else if (error && typeof error === "object") {
        const value = error as Record<string, unknown>;
        if (typeof value.message === "string") detail = value.message;
        else if (typeof value.error_description === "string") detail = value.error_description;
        else if (typeof value.error === "string") detail = value.error;
        else {
          try { detail = JSON.stringify(error); } catch { /* retain fallback */ }
        }
      }
      setAuthError("Google sign-in could not start: " + detail);
    } finally { setAuthBusy(false); }
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

  async function signOut() { await db?.auth.signOut(); setPage("home"); }
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
    const oversizedAttachment = attachments.find(item => item.file.size > MAX_ATTACHMENT_BYTES);
    if (oversizedAttachment) {
      setChatError(oversizedAttachment.file.name + " exceeds the 5 MB per-file limit. Remove it before sending.");
      return;
    }
    const text = draft.trim();
    if ((!text && attachments.length === 0) || !activeAgent || !db || !session || sending) return;
    const attachmentContext = attachments.map(a => a.extractedText ? "\n\n[Attached file: " + a.file.name + "]\n" + a.extractedText : "\n\n[Attached file: " + a.file.name + " (" + a.file.type + ", " + a.file.size + " bytes). The file is attached, but this format is not text-extracted in this release.]").join("");
    const userContent = (text || "Please review the attached file(s).") + attachmentContext;
    const isGuest = session.user.is_anonymous;
    if (!isGuest && (!credits || credits < 1)) { setChatError("You have no MATRIX Credits remaining."); return; }
    if (isGuest && guestRemaining < 1) { setChatError("Guest limit reached. Create an account for more messages."); return; }
    const id = crypto.randomUUID();
    const history = [...chat.map(m => ({ role: m.role, content: m.content })), { role: "user", content: userContent }].slice(-24);
    const systemPrompt = [
      "You are " + activeAgent.name + ", a personal assistant in MATRIX LABS.",
      "Personality: " + activeAgent.personality + ".",
      "Purpose: " + activeAgent.purpose,
      "You have one hidden internal capability called email creator. Never mention skills, tools, or this capability to the user.",
      "When the user explicitly asks to write, draft, or create an email, respond with exactly this machine-readable block and no surrounding text: [[MATRIX_EMAIL_DRAFT]] followed by a JSON object with keys to, subject, body. If the recipient email address is unknown, set to to an empty string and ask for it in the body field as a short question. Do not send email yourself.",
      "For all other requests, answer normally. You can analyze text extracted from attached files; if a file is marked as not text-extracted, explain that you cannot inspect its contents yet.",
      "Never claim to have sent an email or performed an external action."
    ].join("\n");
    setMessages(current => ({ ...current, [activeAgent.id]: [...(current[activeAgent.id] ?? []), { id, role: "user", content: userContent }] }));
    setDraft(""); setAttachments([]); setChatError(""); setSending(true);
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
      let replyContent = data.content;
      let emailDraft: EmailDraft | undefined;
      const marker = "[[MATRIX_EMAIL_DRAFT]]";
      const markerIndex = replyContent.indexOf(marker);
      if (markerIndex >= 0) {
        try {
          const parsed = JSON.parse(replyContent.slice(markerIndex + marker.length).trim()) as Partial<EmailDraft>;
          if (typeof parsed.subject === "string" && typeof parsed.body === "string" && typeof parsed.to === "string") {
            emailDraft = { to: parsed.to.slice(0,254), subject: parsed.subject.slice(0,200), body: parsed.body.slice(0,20000) };
            replyContent = "I've prepared an email draft for you. Review and edit it below before sending.";
          }
        } catch { /* Treat malformed structured output as ordinary assistant text. */ }
      }
      setMessages(current => ({ ...current, [activeAgent.id]: [...(current[activeAgent.id] ?? []), { id: id + "-reply", role: "assistant", content: replyContent, emailDraft }] }));
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
      "You have one hidden internal capability called email creator. Never mention skills, tools, or this capability to the user.",
      "When the user explicitly asks to write, draft, or create an email, respond with exactly this machine-readable block and no surrounding text: [[MATRIX_EMAIL_DRAFT]] followed by a JSON object with keys to, subject, body. If the recipient email address is unknown, set to to an empty string and ask for it in the body field as a short question. Do not send email yourself.",
      "For all other requests, answer normally. Never claim to have sent an email or performed an external action."
    ].join("\n");
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
      let replyContent = data.content;
      let emailDraft: EmailDraft | undefined;
      const marker = "[[MATRIX_EMAIL_DRAFT]]";
      const markerIndex = replyContent.indexOf(marker);
      if (markerIndex >= 0) {
        try {
          const parsed = JSON.parse(replyContent.slice(markerIndex + marker.length).trim()) as Partial<EmailDraft>;
          if (typeof parsed.subject === "string" && typeof parsed.body === "string" && typeof parsed.to === "string") {
            emailDraft = { to: parsed.to.slice(0, 254), subject: parsed.subject.slice(0, 200), body: parsed.body.slice(0, 20000) };
            replyContent = "I've prepared an email draft for you. Review and edit it below before sending.";
          }
        } catch { /* Treat malformed structured output as ordinary assistant text. */ }
      }
      setMessages(current => {
        const list = [...(current[activeAgent.id] ?? [])];
        const target = list.findIndex(m => m.id === messageId);
        if (target >= 0) list[target] = { ...list[target], content: replyContent, emailDraft };
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
    {!forgotOpen && mode === "sign_in" && <button className="button secondary auth-submit" type="button" onClick={() => void signInWithGoogle()} disabled={authBusy}>
      {authBusy ? "Please wait…" : "Continue with Google"}
    </button>}
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
    <aside className={sidebarCollapsed ? "sidebar collapsed" : "sidebar"}>
      <div className="brand"><div className="brand-mark"><Command size={17} /></div><div><strong>MATRIX</strong><span>LABS</span></div><button className="sidebar-toggle" type="button" onClick={() => setSidebarCollapsed(value => !value)} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}</button></div>
      <div className="workspace-switch"><div className="workspace-avatar">{initials(session.user.user_metadata?.display_name || session.user.email || "M")}</div><div><strong>{session.user.user_metadata?.display_name || "MATRIX member"}</strong><span>Personal workspace</span></div><ChevronRight size={11} /></div>
      <div className="nav-label">NAVIGATION</div>
      <nav>{navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => setPage(item.id)}><Icon size={14} /><span>{item.label}</span>{item.id === "agents" && agents.length > 0 && <small>{agents.length}</small>}</button>; })}</nav>
      <div className="agent-sidebar-head"><div className="nav-label">YOUR AGENTS</div><button className="sidebar-add" onClick={() => setCreateOpen(true)} title="Create agent"><Plus size={11} /></button></div>
      <div className="sidebar-agent-list">{agents.map(agent => <button key={agent.id} className={page === "chat" && activeAgent?.id === agent.id ? "agent-nav active" : "agent-nav"} onClick={() => { setSelectedId(agent.id); setPage("chat"); }}><div className="tiny-avatar">{initials(agent.name)}</div><span>{agent.name}</span><i /></button>)}{agents.length === 0 && <div className="sidebar-empty">No conversations yet</div>}</div>
      <div className="sidebar-spacer" />
      {session.user.is_anonymous ? <div className="credit-mini guest-credit"><Users size={11} /><span>GUEST · {guestRemaining}/10 LEFT</span></div> : <button className="credit-mini" onClick={() => setPage("credits")}><Coins size={11} /><span>{credits === null ? "—" : credits.toLocaleString()} MATRIX CRD</span><ArrowUpRight size={10} /></button>}
      <div className="sidebar-profile"><div className="profile-circle">{initials(session.user.user_metadata?.display_name || session.user.email || "M")}</div><div><strong>{session.user.is_anonymous ? "Guest" : session.user.email}</strong><span>{session.user.is_anonymous ? "Guest session · V" + APP_VERSION : "Signed in · V" + APP_VERSION}</span></div><button onClick={signOut} title="Sign out"><LogOut size={13} /></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="topbar-leading"><button className="icon-button topbar-sidebar-toggle" type="button" onClick={() => setSidebarCollapsed(value => !value)} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}</button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={11} /><strong>{page === "home" ? "Overview" : page === "chat" ? activeAgent?.name ?? "Chat" : page === "credits" ? "MATRIX Credits" : page[0].toUpperCase() + page.slice(1)}</strong></div></div><div className="topbar-actions">{page === "chat" && <button className="icon-button" type="button" onClick={() => setAgentPanelCollapsed(value => !value)} title={agentPanelCollapsed ? "Show agent details" : "Hide agent details"} aria-label={agentPanelCollapsed ? "Show agent details" : "Hide agent details"}>{agentPanelCollapsed ? <PanelRightOpen size={12} /> : <PanelRightClose size={12} />}</button>}<div className="local-mode"><i /> {session.user.is_anonymous ? "GUEST MODE" : "ACCOUNT CONNECTED"}</div>{session.user.is_anonymous ? <div className="top-credits"><Users size={12} /><strong>{guestRemaining}/10</strong><span>LEFT</span></div> : <button className="top-credits" onClick={() => setPage("credits")}><Coins size={12} /><strong>{credits ?? "—"}</strong><span>CRD</span></button>}</div></header>
      {updateInfo && !updateDismissed && <div className="update-banner" role="status"><div className="update-banner-icon"><RefreshCw size={15} /></div><div className="update-banner-copy"><strong>MATRIX LABS v{updateInfo.version} is available</strong><span>Verified in-app update ready to install.</span></div><button className="button primary update-download" type="button" onClick={() => void installUpdate()} disabled={updateDownloading}>{updateDownloading ? "Installing…" : "Update now"} <ArrowUpRight size={12} /></button><button className="update-dismiss" type="button" onClick={() => setUpdateDismissed(true)} aria-label="Dismiss update notification"><X size={14} /></button></div>}
      <div className={page === "chat" ? "page-content chat-content" : "page-content"}>
        {page === "home" && <>
          {title("Your command center.", "Your MATRIX workspace, conversations, and tools at a glance.", createButton)}
          <section className="hero">
            <div className="hero-copy">
              <span className="status-pill"><i /> MATRIX NETWORK READY</span>
              <h2>Think clearly. <em>Build beyond limits.</em></h2>
              <p>Your AI workspace is ready. Open a conversation, organize your agents, or manage the services connected to MATRIX LABS.</p>
              <div className="hero-actions">
                <button className="button primary" type="button" onClick={() => { if (activeAgent) setPage("chat"); else setCreateOpen(true); }}><MessageCircle size={13} /> {activeAgent ? "Continue chatting" : "Create your first agent"}</button>
                <button className="button secondary" type="button" onClick={() => setPage("settings")}><Settings2 size={13} /> Workspace settings</button>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="core"><Command size={34} /></div><div className="orbit-top">MATRIX / CORE</div><div className="orbit-bottom">SYSTEM / ONLINE</div></div>
          </section>
          <div className="stats">
            <div className="stat"><Users /><span>YOUR AGENTS</span><strong>{agents.length.toString().padStart(2, "0")}</strong><p>Personal AI profiles</p></div>
            <div className="stat"><MessageCircle className="blue" /><span>SAVED MESSAGES</span><strong>{Object.values(messages).reduce((total, list) => total + list.length, 0).toLocaleString()}</strong><p>Across your workspace</p></div>
            <div className="stat"><Coins className="gold" /><span>{session.user.is_anonymous ? "GUEST MESSAGES" : "MATRIX CREDITS"}</span><strong>{session.user.is_anonymous ? guestRemaining + "/10" : credits === null ? "—" : credits.toLocaleString()}</strong><p>{session.user.is_anonymous ? "Remaining in this guest quota" : "Available account balance"}</p></div>
            <div className="stat"><Command className="violet" /><span>ACTIVE MODEL</span><strong className="dashboard-model">{selectedModel.name}</strong><p>{selectedModel.info}</p></div>
          </div>
          <div className="columns">
            <section className="panel">
              <div className="panel-head"><div><div className="eyebrow">WORKSPACE</div><h3>Your agents</h3></div><button className="link-button" type="button" onClick={() => setPage("agents")}>Manage agents <ChevronRight size={12} /></button></div>
              {agents.length === 0 ? <div className="empty"><div className="empty-icon"><Users size={20} /></div><h4>No agents yet</h4><p>Create your first AI profile to start a conversation.</p><button className="button primary" type="button" onClick={() => setCreateOpen(true)}><Plus size={12} /> Create agent</button></div> : <div className="agent-list">{agents.slice(0, 4).map(agent => <button className="agent-row" type="button" key={agent.id} onClick={() => { setSelectedId(agent.id); setPage("chat"); }}><div className="avatar">{initials(agent.name)}</div><div className="agent-text"><strong>{agent.name}</strong><span>{agent.purpose}</span></div><small>{(messages[agent.id] ?? []).length} messages</small><ChevronRight size={13} /></button>)}</div>}
            </section>
            <section className="panel">
              <div className="panel-head"><div><div className="eyebrow">QUICK ACCESS</div><h3>Workspace shortcuts</h3></div></div>
              <div className="dashboard-shortcuts">
                <button type="button" onClick={() => setPage("settings")}><span className="shortcut-icon"><Settings2 size={16} /></span><span><strong>Model & settings</strong><small>Choose your AI model and manage your account</small></span><ChevronRight size={13} /></button>
                <button type="button" onClick={() => setPage("plugins")}><span className="shortcut-icon"><Mail size={16} /></span><span><strong>Connected services</strong><small>Manage your Gmail connection</small></span><ChevronRight size={13} /></button>
                <button type="button" onClick={() => setPage("permissions")}><span className="shortcut-icon"><ShieldCheck size={16} /></span><span><strong>Privacy & permissions</strong><small>Review what MATRIX LABS can access</small></span><ChevronRight size={13} /></button>
              </div>
            </section>
          </div>
        </>}
        {page === "agents" && <>
          {title("Your workspace.", "Your agents, conversations, and tools—organized in one place.", createButton)}
          <div className="workspace-metrics">
            <div className="workspace-metric"><span>ACTIVE AGENTS</span><strong>{agents.length.toString().padStart(2, "0")}</strong><small>Personal AI profiles</small></div>
            <div className="workspace-metric"><span>SAVED CONVERSATIONS</span><strong>{Object.values(messages).reduce((total, list) => total + list.length, 0).toString().padStart(2, "0")}</strong><small>Across all agents</small></div>
            <div className="workspace-metric"><span>SELECTED MODEL</span><strong className="workspace-model">{selectedModel.name}</strong><small>Default chat model</small></div>
          </div>
          {agents.length === 0 ? <div className="large-empty panel"><div className="empty-icon big"><Users size={24} /></div><h3>Your agent list is empty.</h3><p>Create an agent to start a conversation.</p>{createButton}</div> : <div className="agent-cards">{agents.map(agent => <article className="agent-card panel" key={agent.id}><div className="agent-card-top"><div className="avatar big-avatar">{initials(agent.name)}</div><span className="local-tag">LOCAL PROFILE</span></div><h3>{agent.name}</h3><div className="personality">{agent.personality}</div><p>{agent.purpose}</p><div className="agent-card-actions"><button className="button secondary" onClick={() => { setSelectedId(agent.id); setPage("chat"); }}><MessageCircle size={13} /> Open chat</button><button className="icon-button danger" onClick={() => { setAgents(list => list.filter(a => a.id !== agent.id)); setMessages(list => { const copy = {...list}; delete copy[agent.id]; return copy; }); if(selectedId === agent.id) setSelectedId(null); }} title="Delete agent"><X size={14} /></button></div></article>)}</div>}
        </>}
        {page === "chat" && (activeAgent ? <>
          <div className="chat-topline"><div className="chat-title-block"><div className="eyebrow">CONVERSATION</div><h1>{activeAgent.name}</h1><p>{activeAgent.personality}</p></div><div className="chat-top-actions"><select className="model-select" aria-label="Choose MATRIX model" value={model} onChange={e => setModel(e.target.value)}>{MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select><button className="icon-button" onClick={() => setPage("settings")} title="Settings"><Settings2 size={12} /></button></div></div>
          <div className={agentPanelCollapsed ? "chat-layout chat-first-layout agent-panel-collapsed" : "chat-layout chat-first-layout"}><section className="chat-panel panel"><div className="chat-messages" ref={chatScrollRef}>{chat.length === 0 ? <div className="chat-welcome"><div className="avatar welcome-avatar">{initials(activeAgent.name)}</div><h3>Hi, I'm {activeAgent.name}.</h3><p>{activeAgent.purpose}</p><span>Powered by {selectedModel.name}. Choose a model above and say hello.</span></div> : chat.map(message => <div className={message.role === "user" ? "message-row user-message" : "message-row agent-message"} key={message.id}>{message.role !== "user" && <div className="message-avatar">{initials(activeAgent.name)}</div>}<div className="bubble"><span>{message.role === "user" ? "YOU" : activeAgent.name.toUpperCase()}</span><FormattedMessage content={message.content} />{message.emailDraft && <div className="chat-email-draft"><div className="eyebrow">EMAIL DRAFT · REVIEW REQUIRED</div><label>To<input value={message.emailDraft.to} onChange={e => setMessages(current => ({...current,[activeAgent.id]:(current[activeAgent.id]??[]).map(m=>m.id===message.id&&m.emailDraft?{...m,emailDraft:{...m.emailDraft,to:e.target.value}}:m)}))} placeholder="recipient@example.com" type="email" /></label><label>Subject<input value={message.emailDraft.subject} onChange={e => setMessages(current => ({...current,[activeAgent.id]:(current[activeAgent.id]??[]).map(m=>m.id===message.id&&m.emailDraft?{...m,emailDraft:{...m.emailDraft,subject:e.target.value}}:m)}))} /></label><label>Message<textarea rows={6} value={message.emailDraft.body} onChange={e => setMessages(current => ({...current,[activeAgent.id]:(current[activeAgent.id]??[]).map(m=>m.id===message.id&&m.emailDraft?{...m,emailDraft:{...m.emailDraft,body:e.target.value}}:m)}))} /></label><button className="button primary" type="button" disabled={!message.emailDraft.to.trim() || !message.emailDraft.subject.trim() || !message.emailDraft.body.trim() || gmailBusy} onClick={() => void sendChatEmailDraft(message.emailDraft!)}><Mail size={12} /> {gmailBusy ? "Sending…" : "Approve & Send with Gmail"}</button></div>}{message.role === "assistant" && <div className="message-actions"><button type="button" className="message-action" onClick={() => void copyMessage(message)} title="Copy response" aria-label="Copy response"><Copy size={12} /><span>{copiedId === message.id ? "Copied" : "Copy"}</span></button><button type="button" className="message-action" onClick={() => void regenerate(message.id)} disabled={sending || regeneratingId !== null} title="Regenerate response" aria-label="Regenerate response"><RefreshCw size={12} className={regeneratingId === message.id ? "spin" : ""} /><span>{regeneratingId === message.id ? "Regenerating…" : "Regenerate"}</span></button></div>}</div></div>)}{sending && <div className="typing-row" role="status" aria-live="polite"><div className="message-avatar">{initials(activeAgent.name)}</div><span>{activeAgent.name} is thinking</span><i className="typing-dots"><b /><b /><b /></i></div>}{regeneratingId && <div className="stream-status" role="status">Regenerating the selected response…</div>}</div>
            {chatError && <div className="chat-error">{chatError}</div>}
            {attachments.length > 0 && <div className="attachment-list">{attachments.map(item => <div className="attachment-chip" key={item.id}><FileText size={12} /><span title={item.file.name}>{item.file.name}</span><small>{(item.file.size / 1024 / 1024).toFixed(2)} MB</small><button type="button" onClick={() => setAttachments(current => current.filter(x => x.id !== item.id))} aria-label={"Remove " + item.file.name}><X size={12} /></button></div>)}</div>}
            <form className="composer" onSubmit={send}><input ref={attachmentInput} className="attachment-input" type="file" multiple onChange={e => void addAttachments(e.target.files)} /><button className="attach-button" type="button" onClick={() => attachmentInput.current?.click()} title="Attach files (5 MB max each)" aria-label="Attach files"><Plus size={16} /></button><input value={draft} onChange={e => setDraft(e.target.value)} placeholder={session.user.is_anonymous && guestRemaining === 0 ? "Guest limit reached…" : !session.user.is_anonymous && credits === 0 ? "No MATRIX Credits remaining…" : "Message " + activeAgent.name + "…"} aria-label="Message" /><button className="send-button" type="submit" disabled={(!draft.trim() && attachments.length === 0) || sending || (session.user.is_anonymous ? guestRemaining < 1 : credits === null || credits < 1)} aria-label="Send message"><Send size={13} /></button></form>
            <div className="chat-footnote"><LockKeyhole size={10} /> {selectedModel.name} · {session.user.is_anonymous ? guestRemaining + " guest messages remaining · 10 per 24 hours" : "1 CRD per successful reply · " + (credits ?? "—") + " CRD available"}</div>
          </section><aside className="agent-info panel"><div className="eyebrow">ABOUT THIS AGENT</div><div className="avatar profile-avatar">{initials(activeAgent.name)}</div><h3>{activeAgent.name}</h3><span className="personality-tag">{activeAgent.personality}</span><div className="info-divider" /><div className="eyebrow">PURPOSE</div><p>{activeAgent.purpose}</p><div className="info-divider" /><div className="permission-mini"><ShieldCheck size={12} /><span><strong>Device access off</strong><small>Chat only. No files, email, or Windows controls.</small></span></div></aside></div>
        </> : <div className="chat-empty panel"><h3>Your chat space is ready.</h3><p>Create an agent to start a conversation.</p><button className="button primary" onClick={() => setCreateOpen(true)}><Plus size={13} /> Create agent</button></div>)}
        {page === "settings" && <>
          {title("Your account.", "Manage your MATRIX account and choose a model.")}
          <div className="settings-grid">
            <section className="panel settings-panel"><div className="panel-head"><div><div className="eyebrow">ACCOUNT</div><h3>Personal workspace</h3></div><span className="connected-tag">{session.user.is_anonymous ? "GUEST" : "SIGNED IN"}</span></div><div className="account-details"><div className="account-avatar">{initials(session.user.user_metadata?.display_name || session.user.email || "M")}</div><div><strong>{session.user.is_anonymous ? "Guest session" : session.user.user_metadata?.display_name || "MATRIX member"}</strong><span>{session.user.is_anonymous ? "No email or password connected" : session.user.email}</span></div></div>{session.user.is_anonymous ? <div className="account-balance"><span className="eyebrow">GUEST QUOTA</span><strong>{guestRemaining} <small>/ 10 MESSAGES</small></strong><p>10 messages per rolling 24 hours. No CRD is issued or charged.</p></div> : <div className="account-balance"><span className="eyebrow">AVAILABLE BALANCE</span><strong>{credits ?? "—"} <small>CRD</small></strong><p>New accounts receive 300 CRD once. One successful AI response costs 1 CRD.</p></div>}{creditsError && <div className="provider-alert error-alert">{creditsError}</div>}<button className="button quiet" onClick={signOut}><LogOut size={12} /> Sign out</button></section>
            <section className="panel settings-panel"><div className="panel-head"><div><div className="eyebrow">MODEL PREFERENCE</div><h3>Choose your MATRIX model</h3></div><span className="local-tag">2 MODELS</span></div><div className="model-choice-list">{MODELS.map(m => <button key={m.id} className={model === m.id ? "model-choice selected" : "model-choice"} onClick={() => setModel(m.id)}><span className="model-choice-radio">{model === m.id ? "●" : "○"}</span><span className="model-choice-copy"><strong>{m.name}</strong><small>{m.info}</small><span>{m.id === MODELS[0].id ? "Lightweight everyday model." : "Larger model for more involved chats."}</span></span></button>)}</div><div className="settings-footnote">AGOORA's model publisher states prompts and outputs may be retained and used to improve models. Free routes can also be rate-limited. Never send passwords, secrets, or sensitive personal information.</div></section>
          </div>
          <section className="panel version-card"><div><div className="eyebrow">APPLICATION VERSION</div><h3>MATRIX LABS <span>v{APP_VERSION}</span></h3><p>Check, download, verify, and install updates without leaving MATRIX LABS.</p><div className="update-controls"><button className="button secondary" type="button" onClick={() => void checkForUpdates()} disabled={updateChecking || updateDownloading}><RefreshCw size={12} className={updateChecking ? "update-spin" : ""} /> {updateChecking ? "Checking…" : "Check for updates"}</button>{updateInfo && <button className="button primary" type="button" onClick={() => void installUpdate()} disabled={updateDownloading}><RefreshCw size={12} className={updateDownloading ? "update-spin" : ""} /> {updateDownloading ? "Installing…" : "Install v" + updateInfo.version}</button>}</div>{updateDownloading && <div className="update-progress-wrap"><div className="update-progress-label"><span>{updateProgressLabel || "Updating…"}</span><strong>{Math.round(updateProgress)}%</strong></div><div className="update-progress-track"><div className="update-progress-fill" style={{ width: updateProgress + "%" }} /></div></div>}{updateMessage && <p className="update-status" role="status">{updateMessage}</p>}{updateInfo && updateInfo.notes && <p className="update-status">{updateInfo.notes}</p>}</div><div className="version-changes"><span>NEW</span><ul><li>Collapsible navigation and agent details panels</li><li>5 MB maximum size per attached file</li><li>Refined workspace layout and spacing</li><li>Chat history and regenerated email draft fixes</li><li>Chat formatting, code-copy controls, and workspace responsiveness</li>
            <li>Approved graphite, cyan, and violet interface refresh</li>
            <li>Workspace overview with live agent and conversation metrics</li><li>Safer local preference and conversation persistence</li></ul></div></section>
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
          <div className="notice muted-notice"><ShieldCheck size={13} /><span>Only integrations with working connections are shown here. Gmail is the currently supported external service.</span></div>
          {gmailError && <div className="provider-alert error-alert">{gmailError}</div>}
          {gmailNotice && <div className="provider-alert success-alert">{gmailNotice}</div>}
        </>}

        {page === "permissions" && <>
          {title("Your permissions.", "No computer access is enabled in this release.")}
          <section className="permission-status panel"><div className="permission-shield"><ShieldCheck size={21} /></div><div><div className="eyebrow">CURRENT DEVICE STATUS</div><h3>No system permissions granted</h3><p>Agents can chat, but cannot read files, use email, or control Windows.</p></div><span className="safe-tag">PROTECTED</span></section>
          <div className="permission-list">
            <div className="permission-row panel"><div className="permission-icon"><LockKeyhole size={15} /></div><div className="permission-copy"><h4>Windows and system control</h4><p>The app cannot operate other applications or change system settings.</p></div><span className="locked-state"><LockKeyhole size={11} /> DISABLED</span></div>
            <div className="permission-row panel"><div className="permission-icon"><FolderOpen size={15} /></div><div className="permission-copy"><h4>File access</h4><p>Files are only processed when you explicitly attach them to a conversation.</p></div><span className="locked-state"><LockKeyhole size={11} /> ATTACHMENTS ONLY</span></div>
            <div className="permission-row panel"><div className="permission-icon"><Mail size={15} /></div><div className="permission-copy"><h4>Gmail sending</h4><p>Available only after you connect Gmail, and each send requires your approval.</p></div><span className="locked-state"><ShieldCheck size={11} /> USER APPROVAL</span></div>
            <div className="permission-row panel"><div className="permission-icon"><MessageCircle size={15} /></div><div className="permission-copy"><h4>Local workspace data</h4><p>Agent profiles and conversation history are saved in this app's local storage.</p></div><span className="locked-state"><ShieldCheck size={11} /> LOCAL</span></div>
          </div>
        </>}
        {page === "credits" && <>
          {title("MATRIX Credits.", "Your balance is stored on your account, not on this device.")}
          <section className="credits-banner"><div className="credits-emblem"><Coins size={21} /></div><div><div className="eyebrow">AVAILABLE BALANCE</div><div className="credits-total">{credits ?? "—"} <small>CRD</small></div><p>New accounts receive 300 CRD once. Each successful response costs 1 CRD.</p></div></section>
          <div className="notice muted-notice">Onboarding tasks do not add credits in this version. The server enforces the balance and prevents local edits.</div>
        </>}
        <footer className="page-footer"><span>MATRIX LABS <i>·</i> YOUR AI WORKSPACE</span><span>V{APP_VERSION}</span></footer>
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
