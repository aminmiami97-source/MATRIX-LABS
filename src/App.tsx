import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowUpRight, Bot, Check, CheckCircle2, ChevronRight, Coins, Command,
  FileText, FolderOpen, LayoutDashboard, ListTodo, LockKeyhole,
  MessageCircle, Mic, Plus, Send, Settings2, ShieldCheck, Sparkles,
  Users, X
} from "lucide-react";

type Page = "overview" | "agents" | "tasks" | "permissions" | "settings" | "chat";
type Agent = { id: string; name: string; purpose: string; personality: string };
type ChatMessage = { id: string; role: "user" | "assistant" | "agent"; content: string };
type ProviderId = "gemini" | "openai";
type MessageStore = Record<string, ChatMessage[]>;

const KEYS = {
  agents: "matrix-labs.agents.v1",
  credits: "matrix-labs.credits.v1",
  completed: "matrix-labs.completed-tasks.v1",
  messages: "matrix-labs.messages.v1",
  provider: "matrix-labs.provider.v1",
  model: "matrix-labs.model.v1"
};

function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "AI";
}

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "agents", label: "My agents", icon: Users },
  { id: "tasks", label: "Task board", icon: ListTodo },
  { id: "permissions", label: "Permissions", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings2 }
] as const;

const tasks = [
  { id: "first-agent", title: "Create your first agent", detail: "Give your workspace its first personality.", reward: 20, category: "AGENT WORKSHOP" },
  { id: "open-permissions", title: "Explore the permission center", detail: "See how access will stay in your control.", reward: 10, category: "SAFETY" },
  { id: "first-message", title: "Send your agent a message", detail: "Try the local chat preview.", reward: 15, category: "CONVERSATION" }
];

function App() {
  const [page, setPage] = useState<Page>("overview");
  const [agents, setAgents] = useState<Agent[]>(() => readLocal(KEYS.agents, []));
  const [credits, setCredits] = useState(() => readLocal(KEYS.credits, 0));
  const [completed, setCompleted] = useState<string[]>(() => readLocal(KEYS.completed, []));
  const [messages, setMessages] = useState<MessageStore>(() => readLocal(KEYS.messages, {}));
  const [selectedId, setSelectedId] = useState<string | null>(() => readLocal<Agent[]>(KEYS.agents, [])[0]?.id ?? null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [personality, setPersonality] = useState("Calm and helpful");
  const [draft, setDraft] = useState("");
  const [provider, setProvider] = useState<ProviderId>(() => readLocal(KEYS.provider, "gemini" as ProviderId));
  const [model, setModel] = useState(() => readLocal(KEYS.model, "gemini-3.8-flash"));
  const [providerKeys, setProviderKeys] = useState<Record<ProviderId, boolean>>({ gemini: false, openai: false });
  const [providerKeyInput, setProviderKeyInput] = useState("");
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerMessage, setProviderMessage] = useState("");
  const [providerError, setProviderError] = useState("");
  const [bridgeAvailable, setBridgeAvailable] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => localStorage.setItem(KEYS.agents, JSON.stringify(agents)), [agents]);
  useEffect(() => localStorage.setItem(KEYS.credits, JSON.stringify(credits)), [credits]);
  useEffect(() => localStorage.setItem(KEYS.completed, JSON.stringify(completed)), [completed]);
  useEffect(() => localStorage.setItem(KEYS.messages, JSON.stringify(messages)), [messages]);
  useEffect(() => localStorage.setItem(KEYS.provider, JSON.stringify(provider)), [provider]);
  useEffect(() => localStorage.setItem(KEYS.model, JSON.stringify(model)), [model]);

  useEffect(() => {
    let mounted = true;
    const loadCredentialStatus = async () => {
      try {
        const [gemini, openai] = await Promise.all([
          invoke<boolean>("provider_key_status", { provider: "gemini" }),
          invoke<boolean>("provider_key_status", { provider: "openai" })
        ]);
        if (mounted) {
          setProviderKeys({ gemini, openai });
          setBridgeAvailable(true);
        }
      } catch {
        if (mounted) {
          setBridgeAvailable(false);
          setProviderError("Secure provider storage is available in the installed Windows app. Open the installed MATRIX LABS desktop build.");
        }
      }
    };
    void loadCredentialStatus();
    return () => { mounted = false; };
  }, []);

  const activeAgent = agents.find((agent) => agent.id === selectedId) ?? agents[0] ?? null;
  const chatMessages = activeAgent ? messages[activeAgent.id] ?? [] : [];
  const titles: Record<Page, string> = {
    overview: "Overview", agents: "My agents", tasks: "Task board",
    permissions: "Permissions", settings: "Settings", chat: activeAgent?.name ?? "Agent chat"
  };

  function awardTask(id: string, amount: number) {
    if (completed.includes(id)) return;
    setCompleted((current) => current.includes(id) ? current : [...current, id]);
    setCredits((current) => current + amount);
  }

  function go(next: Page) {
    setPage(next);
    if (next === "permissions") awardTask("open-permissions", 10);
  }

  function openCreate() {
    setName("");
    setPurpose("");
    setPersonality("Calm and helpful");
    setModalOpen(true);
  }

  function createAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    const agent: Agent = {
      id: Date.now().toString(),
      name: cleanName,
      purpose: purpose.trim() || "A personal assistant for everyday tasks.",
      personality
    };
    setAgents((current) => [...current, agent]);
    setSelectedId(agent.id);
    setModalOpen(false);
    setPage("chat");
    awardTask("first-agent", 20);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeAgent || isSending) return;

    if (!providerKeys[provider]) {
      setChatError("Connect an AI provider in Settings before sending messages.");
      setPage("settings");
      return;
    }

    const id = Date.now().toString();
    const userMessage: ChatMessage = { id: id + "-u", role: "user", content: text };
    const history = [
      ...chatMessages.map((message) => ({
        role: message.role === "agent" ? "assistant" : message.role,
        content: message.content
      })),
      { role: "user", content: text }
    ].slice(-24);

    const systemPrompt = [
      "You are " + activeAgent.name + ", a personal assistant inside MATRIX LABS.",
      "Personality: " + activeAgent.personality + ".",
      "Purpose: " + activeAgent.purpose,
      "You are chat-only in this version. You have no computer tools, no file access, no email access, and no shell access.",
      "Never claim to have changed the user's computer, read a file, sent an email, or performed an external action.",
      "If asked to perform a computer action, explain that device capabilities are not connected in this version."
    ].join("\n");

    setChatError("");
    setDraft("");
    setMessages((current) => ({
      ...current,
      [activeAgent.id]: [...(current[activeAgent.id] ?? []), userMessage]
    }));
    setIsSending(true);

    try {
      const reply = await invoke<{ content: string; provider: string; model: string }>("send_ai_message", {
        provider,
        model,
        systemPrompt,
        messages: history
      });
      const assistantMessage: ChatMessage = {
        id: id + "-a",
        role: "assistant",
        content: reply.content
      };
      setMessages((current) => ({
        ...current,
        [activeAgent.id]: [...(current[activeAgent.id] ?? []), assistantMessage]
      }));
      awardTask("first-message", 15);
    } catch (error) {
      setChatError(String(error));
    } finally {
      setIsSending(false);
    }
  }

  async function saveProviderKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const secret = providerKeyInput.trim();
    if (!secret) {
      setProviderError("Enter an API key first.");
      return;
    }
    if (!bridgeAvailable) {
      setProviderError("Secure provider storage is unavailable. Use the installed Windows desktop app.");
      return;
    }
    setProviderBusy(true);
    setProviderError("");
    setProviderMessage("");
    try {
      await invoke<void>("save_provider_key", { provider, apiKey: secret });
      setProviderKeys((current) => ({ ...current, [provider]: true }));
      setProviderKeyInput("");
      setProviderMessage("Connected. Your API key is stored in Windows Credential Manager, not in browser storage.");
    } catch (error) {
      setProviderError(String(error));
    } finally {
      setProviderBusy(false);
    }
  }

  async function removeProviderKey() {
    setProviderBusy(true);
    setProviderError("");
    setProviderMessage("");
    try {
      await invoke<void>("delete_provider_key", { provider });
      setProviderKeys((current) => ({ ...current, [provider]: false }));
      setProviderMessage("The saved provider key was removed from Windows Credential Manager.");
    } catch (error) {
      setProviderError(String(error));
    } finally {
      setProviderBusy(false);
    }
  }

  function chooseProvider(nextProvider: ProviderId) {
    setProvider(nextProvider);
    setModel(nextProvider === "gemini" ? "gemini-3.8-flash" : "gpt-6-luna");
    setProviderKeyInput("");
    setProviderMessage("");
    setProviderError("");
  }

  function removeAgent(id: string) {
    const next = agents.filter((agent) => agent.id !== id);
    setAgents(next);
    setMessages((current) => {
      const copy = { ...current };
      delete copy[id];
      return copy;
    });
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null);
      setPage("agents");
    }
  }

  const heading = (eyebrow: string, title: string, description: string, action?: ReactNode) => (
    <div className="page-heading">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  );

  const createButton = <button className="button primary" onClick={openCreate}><Plus size={16} /> Create agent</button>;

  function overview() {
    return <>
      {heading("YOUR WORKSPACE", "Your agent workspace.", "A calm place to build useful agents, one permission at a time.", createButton)}
      <section className="hero">
        <div className="hero-copy">
          <div className="status-pill"><i /> EARLY ACCESS PREVIEW</div>
          <h2>More capable by design.<br /><em>Always under your control.</em></h2>
          <p>Create an assistant with its own name and personality. Add real capabilities only when the permission system is ready.</p>
          <div className="hero-actions">
            <button className="button primary" onClick={openCreate}><Sparkles size={16} /> Build your first agent</button>
            <button className="button quiet" onClick={() => go("permissions")}>Explore permissions <ArrowUpRight size={14} /></button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="core"><Command size={32} /></div><span className="orbit-top">LOCAL FIRST</span><span className="orbit-bottom"><ShieldCheck size={12} /> HUMAN APPROVAL</span></div>
      </section>

      <div className="stats">
        <div className="stat"><Bot /><span>Your agents</span><strong>{agents.length}<small> created</small></strong><p>Personalities in your workspace</p></div>
        <div className="stat"><Coins className="gold" /><span>MATRIX Credits</span><strong>{credits}<small> credits</small></strong><p>Earned through preview tasks</p></div>
        <div className="stat"><ListTodo className="blue" /><span>Tasks completed</span><strong>{completed.length}<small> / 3</small></strong><p>Small steps, real progress</p></div>
        <div className="stat"><LockKeyhole className="violet" /><span>System permissions</span><strong>0<small> active</small></strong><p>No laptop access is enabled</p></div>
      </div>

      <div className="columns">
        <section className="panel">
          <div className="panel-head"><div><div className="eyebrow">THE WORKSHOP</div><h3>Your agents</h3></div><button className="link-button" onClick={() => go("agents")}>View all <ChevronRight size={14} /></button></div>
          {agents.length === 0 ? <div className="empty"><div className="empty-icon"><Bot size={24} /></div><h4>No agents yet</h4><p>Your first agent starts with a name, purpose, and personality.</p><button className="button secondary" onClick={openCreate}><Plus size={14} /> Create an agent</button></div> :
            <div className="agent-list">{agents.slice(0, 3).map((agent) => <button className="agent-row" key={agent.id} onClick={() => { setSelectedId(agent.id); setPage("chat"); }}><div className="avatar">{initials(agent.name)}</div><div className="agent-text"><strong>{agent.name}</strong><span>{agent.personality} · {agent.purpose}</span></div><MessageCircle size={15} /></button>)}</div>}
        </section>
        <section className="panel">
          <div className="panel-head"><div><div className="eyebrow">GETTING STARTED</div><h3>Next small steps</h3></div><button className="link-button" onClick={() => go("tasks")}>Task board <ChevronRight size={14} /></button></div>
          <div className="quick-tasks">{tasks.map((task) => <div className="quick-task" key={task.id}><div className={completed.includes(task.id) ? "task-check done" : "task-check"}>{completed.includes(task.id) && <Check size={12} />}</div><div><strong>{task.title}</strong><span>+{task.reward} credits</span></div>{completed.includes(task.id) && <small>DONE</small>}</div>)}</div>
        </section>
      </div>
      <div className="notice"><ShieldCheck size={17} /><span><strong>Permission-first, by default.</strong> This preview cannot read, edit, or send anything from your laptop.</span><button onClick={() => go("permissions")}>Learn more <ArrowUpRight size={13} /></button></div>
    </>;
  }

  function agentsPage() {
    return <>
      {heading("AGENT WORKSHOP", "Meet your agents.", "Create distinct assistants and shape how each one communicates.", createButton)}
      {agents.length === 0 ? <div className="large-empty panel"><div className="empty-icon big"><Users size={28} /></div><h3>Your workshop is ready.</h3><p>There are no agents in this workspace yet. Create one to give it a name, purpose, and personality.</p>{createButton}</div> :
        <div className="agent-cards">{agents.map((agent) => <article className="agent-card panel" key={agent.id}><div className="agent-card-top"><div className="avatar big-avatar">{initials(agent.name)}</div><span className="local-tag"><i /> LOCAL PROFILE</span></div><h3>{agent.name}</h3><div className="personality">{agent.personality}</div><p>{agent.purpose}</p><div className="agent-card-actions"><button className="button secondary" onClick={() => { setSelectedId(agent.id); setPage("chat"); }}><MessageCircle size={14} /> Open chat</button><button className="icon-button danger" title="Delete agent" onClick={() => removeAgent(agent.id)}><X size={16} /></button></div></article>)}</div>}
    </>;
  }

  function tasksPage() {
    const earned = tasks.filter((task) => completed.includes(task.id)).reduce((sum, task) => sum + task.reward, 0);
    return <>
      {heading("MATRIX CREDITS", "Progress has its perks.", "Complete simple workspace tasks to earn MATRIX Credits.")}
      <section className="credits-banner"><div className="credits-emblem"><Coins size={25} /></div><div><div className="eyebrow">YOUR BALANCE</div><div className="credits-total">{credits} <small>credits</small></div><p>Local demo points — not AI provider tokens or cash.</p></div><div className="progress-area"><span>{completed.length} of 3 tasks</span><div className="progress"><i style={{ width: (completed.length / 3 * 100) + "%" }} /></div><small>{earned} credits earned from tasks</small></div></section>
      <div className="task-list">{tasks.map((task, index) => {
        const isDone = completed.includes(task.id);
        const action = task.id === "first-agent" ? () => { setPage("agents"); openCreate(); } : task.id === "open-permissions" ? () => go("permissions") : () => activeAgent ? setPage("chat") : openCreate();
        return <article className="task-card panel" key={task.id}><div className="task-number">0{index + 1}</div><div className="task-copy"><div className="eyebrow">{task.category}</div><h3>{task.title}</h3><p>{task.detail}</p></div><div className="reward"><Coins size={13} /> +{task.reward}</div>{isDone ? <span className="done-label"><CheckCircle2 size={15} /> Completed</span> : <button className="button secondary" onClick={action}>Start task <ArrowUpRight size={14} /></button>}</article>;
      })}</div>
      <div className="notice muted-notice">More tasks and a server-verified credit ledger will be added after the core app is running.</div>
    </>;
  }

  function permissionsPage() {
    const rows = [
      { icon: FolderOpen, title: "Read files in a selected folder", detail: "Future access will be limited to folders you choose." },
      { icon: FileText, title: "Create or edit documents", detail: "Changes will be previewed before anything is written." },
      { icon: MessageCircle, title: "Create email drafts", detail: "Account connection and draft review will be required." }
    ];
    return <>
      {heading("CONTROL CENTER", "Your permissions.", "Review exactly what an agent can access. Nothing is connected in this preview.")}
      <section className="permission-status panel"><div className="permission-shield"><ShieldCheck size={24} /></div><div><div className="eyebrow">CURRENT DEVICE STATUS</div><h3>No system permissions granted</h3><p>Agents currently have no access to your files, email, microphone, or other Windows features.</p></div><span className="safe-tag"><i /> PROTECTED</span></section>
      <div className="section-label">CAPABILITY CATALOG</div>
      <div className="permission-list">{rows.map((row) => { const Icon = row.icon; return <div className="permission-row panel" key={row.title}><div className="permission-icon"><Icon size={19} /></div><div className="permission-copy"><h4>{row.title}</h4><p>{row.detail}</p></div><span className="locked-state"><LockKeyhole size={13} /> NOT AVAILABLE YET</span></div>; })}</div>
      <div className="security-callout"><LockKeyhole size={18} /><div><strong>Agents cannot approve their own access.</strong><p>Later, every action will pass through native permission checks and an approval screen. The model will only be able to propose actions.</p></div></div>
    </>;
  }

  function settingsPage() {
    return <>
      {heading("PREFERENCES", "Connect your AI.", "Choose a provider for your agents. Your API key is saved in Windows Credential Manager.")}
      <div className="settings-grid">
        <section className="panel settings-panel provider-panel">
          <div className="panel-head"><div><div className="eyebrow">AI CONNECTION</div><h3>Provider setup</h3></div><span className={providerKeys[provider] ? "connected-tag" : "coming-tag"}>{providerKeys[provider] ? "CONNECTED" : "NOT CONNECTED"}</span></div>
          <form className="provider-form" onSubmit={saveProviderKey}>
            <label htmlFor="provider-choice">AI provider</label>
            <select id="provider-choice" className="field" value={provider} onChange={(event) => chooseProvider(event.target.value as ProviderId)}>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
            <label htmlFor="provider-model">Model ID</label>
            <input id="provider-model" className="field" value={model} onChange={(event) => setModel(event.target.value)} maxLength={80} spellCheck={false} placeholder={provider === "gemini" ? "gemini-3.8-flash" : "gpt-6-luna"} />
            <label htmlFor="provider-key">API key</label>
            <input id="provider-key" className="field" type="password" value={providerKeyInput} onChange={(event) => setProviderKeyInput(event.target.value)} autoComplete="off" spellCheck={false} placeholder={providerKeys[provider] ? "A key is already saved. Enter a new key to replace it." : "Paste your provider API key"} />
            <div className="provider-key-note"><LockKeyhole size={14} /><span>The key is sent to the native Rust app and saved in Windows Credential Manager. It is not saved in localStorage or GitHub.</span></div>
            {providerError && <div className="provider-alert error-alert">{providerError}</div>}
            {providerMessage && <div className="provider-alert success-alert">{providerMessage}</div>}
            <div className="provider-actions">
              <button type="submit" className="button primary" disabled={providerBusy || !providerKeyInput.trim() || !bridgeAvailable}>{providerBusy ? "Saving…" : providerKeys[provider] ? "Replace API key" : "Save API key"}</button>
              {providerKeys[provider] && <button type="button" className="button quiet" onClick={removeProviderKey} disabled={providerBusy}>Remove key</button>}
            </div>
          </form>
        </section>
        <section className="panel settings-panel">
          <div className="panel-head"><div><div className="eyebrow">LOCAL DATA</div><h3>Your workspace data</h3></div><span className="local-tag">ON THIS DEVICE</span></div>
          <div className="setting-row"><div><strong>Agent profiles</strong><span>Saved in this app's local web storage.</span></div><CheckCircle2 /></div>
          <div className="setting-row"><div><strong>Conversation history</strong><span>Stored locally by this app.</span></div><CheckCircle2 /></div>
          <div className="setting-row"><div><strong>Provider credentials</strong><span>Stored by Windows Credential Manager.</span></div><ShieldCheck /></div>
          <div className="settings-footnote">The selected provider receives the agent instructions and recent messages when you send a chat. Do not send passwords or other sensitive information.</div>
        </section>
      </div>
      <div className="notice"><ShieldCheck size={17} /><span><strong>AI usage is separate from MATRIX Credits.</strong> Your provider may apply its own usage limits or charges. Check the provider's account settings before connecting a key.</span></div>
    </>;
  }

  function chatPage() {
    if (!activeAgent) return <>{heading("AGENT CHAT", "Start a conversation.", "Create an agent before opening its chat.", createButton)}<div className="large-empty panel"><div className="empty-icon big"><MessageCircle size={27} /></div><h3>Your next conversation starts here.</h3><p>Create an agent and it will appear in your workshop.</p>{createButton}</div></>;
    const connected = providerKeys[provider];
    const providerName = provider === "gemini" ? "Gemini" : "OpenAI";
    return <>
      {heading("AGENT SPACE", activeAgent.name, "A private conversation with your configured AI provider.")}
      <div className="chat-layout">
        <section className="chat-panel panel">
          <div className="chat-header"><div className="avatar">{initials(activeAgent.name)}</div><div className="chat-agent-title"><strong>{activeAgent.name}</strong><span>{activeAgent.personality}</span></div><span className={connected ? "connected-tag" : "preview-tag"}>{connected ? "AI CONNECTED" : "SETUP REQUIRED"}</span></div>
          <div className="chat-messages">
            {chatMessages.length === 0 ? <div className="chat-welcome"><div className="avatar welcome-avatar">{initials(activeAgent.name)}</div><h3>Hi, I'm {activeAgent.name}.</h3><p>{activeAgent.purpose}</p><span>{connected ? "Your " + providerName + " connection is ready. Send a message to begin." : "Connect Gemini or OpenAI in Settings to start a real AI conversation."}</span></div> : chatMessages.map((message) => <div className={message.role === "user" ? "message-row user-message" : "message-row agent-message"} key={message.id}>{message.role !== "user" && <div className="message-avatar">{initials(activeAgent.name)}</div>}<div className="bubble"><span>{message.role === "user" ? "YOU" : activeAgent.name.toUpperCase()}</span><p>{message.content}</p></div></div>)}
            {isSending && <div className="typing-row"><div className="message-avatar">{initials(activeAgent.name)}</div><span>{activeAgent.name} is thinking…</span></div>}
          </div>
          {chatError && <div className="chat-error">{chatError}</div>}
          <form className="composer" onSubmit={sendMessage}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={connected ? "Message " + activeAgent.name + "…" : "Connect a provider in Settings first…"} aria-label="Message" /><button type="button" className="voice-button" disabled title="Voice conversations are planned for a later version"><Mic size={17} /></button><button type="submit" className="send-button" disabled={!draft.trim() || isSending || !connected} aria-label="Send message"><Send size={17} /></button></form>
          <div className="chat-footnote"><LockKeyhole size={12} /> {connected ? "Recent messages are sent securely to " + providerName + " for responses. Device permissions remain off." : "No AI provider connected. Your existing chat history remains on this device."}</div>
        </section>
        <aside className="agent-info panel"><div className="eyebrow">AGENT PROFILE</div><div className="avatar profile-avatar">{initials(activeAgent.name)}</div><h3>{activeAgent.name}</h3><span className="personality-tag">{activeAgent.personality}</span><div className="info-divider" /><div className="eyebrow">PURPOSE</div><p>{activeAgent.purpose}</p><div className="info-divider" /><div className="permission-mini"><ShieldCheck size={16} /><span><strong>Device permissions off</strong><small>This agent can chat, but cannot access files, email, or Windows controls.</small></span></div></aside>
      </div>
    </>;
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Command size={20} /></div><div><strong>MATRIX</strong><span>LABS</span></div></div>
      <div className="workspace-switch"><div className="workspace-avatar">A</div><div><strong>Personal workspace</strong><span>Local environment</span></div><ChevronRight size={14} /></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => go(item.id)}><Icon size={17} /><span>{item.label}</span>{item.id === "agents" && agents.length > 0 && <small>{agents.length}</small>}</button>; })}</nav>
      {activeAgent && <><div className="nav-label agent-label">YOUR AGENTS</div><button className={page === "chat" ? "agent-nav active" : "agent-nav"} onClick={() => { setSelectedId(activeAgent.id); setPage("chat"); }}><div className="tiny-avatar">{initials(activeAgent.name)}</div><span>{activeAgent.name}</span><i /></button></>}
      <div className="sidebar-spacer" />
      <div className="credit-box"><div><span>MATRIX CREDITS</span><Coins size={15} /></div><strong>{credits.toLocaleString()} <small>CR</small></strong><footer><span>Earned through tasks</span><button onClick={() => go("tasks")}>View tasks <ArrowUpRight size={12} /></button></footer></div>
      <div className="sidebar-profile"><div className="profile-circle">A</div><div><strong>Local profile</strong><span>Preview build · v0.2.0</span></div><button onClick={() => go("settings")} title="Settings"><Settings2 size={16} /></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{titles[page]}</strong></div><div className="topbar-actions"><div className="local-mode"><i /> DEVICE ACCESS OFF</div><button className="top-credits" onClick={() => go("tasks")}><Coins size={15} /><strong>{credits}</strong><span>credits</span></button></div></header>
      <div className={page === "chat" ? "page-content chat-content" : "page-content"}>
        {page === "overview" && overview()}
        {page === "agents" && agentsPage()}
        {page === "tasks" && tasksPage()}
        {page === "permissions" && permissionsPage()}
        {page === "settings" && settingsPage()}
        {page === "chat" && chatPage()}
        <footer className="page-footer"><span>MATRIX LABS <i>·</i> BUILDING WITH PERMISSION</span><span>PREVIEW 0.2.0</span></footer>
      </div>
    </main>

    {modalOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><form className="create-modal" onSubmit={createAgent}>
      <div className="modal-head"><div><div className="eyebrow">AGENT WORKSHOP</div><h2>Create an agent</h2><p>Start with an identity. Capabilities can be added later.</p></div><button type="button" className="icon-button" onClick={() => setModalOpen(false)} aria-label="Close"><X size={18} /></button></div>
      <label htmlFor="agent-name">Agent name</label><input id="agent-name" className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. NOVA" maxLength={32} required autoFocus />
      <label htmlFor="agent-purpose">What is this agent for?</label><textarea id="agent-purpose" className="field" value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="A study partner, project organizer, writing helper…" maxLength={180} rows={3} />
      <label htmlFor="agent-personality">Personality</label><select id="agent-personality" className="field" value={personality} onChange={(event) => setPersonality(event.target.value)}><option>Calm and helpful</option><option>Focused and professional</option><option>Curious and creative</option><option>Friendly and encouraging</option><option>Concise and direct</option></select>
      <div className="modal-note"><ShieldCheck size={16} /><span>This creates a local profile only. No AI service or computer permissions are connected.</span></div>
      <div className="modal-actions"><button type="button" className="button quiet" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="button primary" disabled={!name.trim()}><Plus size={15} /> Create agent</button></div>
    </form></div>}
  </div>;
}

export default App;