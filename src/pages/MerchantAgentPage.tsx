/**
 * /merchant/:slug/agent — OMS Wave 1.6 surface.
 *
 * Merchant chat surface for the integration agent. Loads (or auto-spawns)
 * an `agent_sessions` row for the merchant via /api/merchants/:slug/
 * agent-session, then posts each user turn to /api/agent-chat with the
 * sessionId so persistence + cost tracking happens server-side.
 *
 * Renders fenced code blocks with a copy button. Provides two CTAs:
 *   - "Approve & continue" — confirms the agent's plan, posts a canned
 *     user reply
 *   - "I need human help" — flips the local UI to an escalation banner
 *     so Vic can see this in the dashboard (escalation event is a future
 *     enhancement; this client-side gate is the MVP)
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

interface AgentMessage {
  id?: number;
  role: 'system' | 'user' | 'assistant';
  content: string;
  modelUsed?: string | null;
  createdAt?: string;
}

interface SessionInfo {
  id: number;
  merchantId: number;
  topic: string;
  status: string;
  totalCostMicroUsd: number;
  messageCount: number;
  createdAt: string;
}

function renderContent(content: string): React.ReactNode {
  // Minimal code-fence renderer. Recognises ```lang\n...\n``` blocks.
  const parts: React.ReactNode[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <p key={`t${key}`} style={{ whiteSpace: 'pre-wrap', margin: '0 0 8px' }}>
          {content.slice(lastIndex, match.index)}
        </p>,
      );
    }
    const lang = match[1] ?? '';
    const code = match[2] ?? '';
    parts.push(<CodeBlock key={`c${key}`} lang={lang} code={code} />);
    key += 1;
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(
      <p key={`t${key}`} style={{ whiteSpace: 'pre-wrap', margin: '0 0 8px' }}>
        {content.slice(lastIndex)}
      </p>,
    );
  }
  return parts;
}

function CodeBlock({ lang, code }: { lang: string; code: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <pre
      style={{
        background: '#0a0a0a',
        color: '#e5e7eb',
        padding: 12,
        borderRadius: 6,
        fontSize: 12,
        margin: '0 0 12px',
        position: 'relative',
        overflow: 'auto',
      }}
    >
      {lang && (
        <small style={{ color: '#9ca3af', fontFamily: 'sans-serif' }}>{lang}</small>
      )}
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          padding: '2px 8px',
          fontSize: 11,
          background: copied ? '#16a34a' : '#374151',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <code>{code}</code>
    </pre>
  );
}

export default function MerchantAgentPage(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [escalated, setEscalated] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setError(null);
    fetch(`/api/merchants/${encodeURIComponent(slug)}/agent-session`)
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError((j as { error?: string }).error ?? `HTTP ${res.status}`);
          return;
        }
        const data = j as { session: SessionInfo; messages: AgentMessage[] };
        setSession(data.session);
        setMessages(
          data.messages.filter((m) => m.role === 'user' || m.role === 'assistant'),
        );
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Session load failed.');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(content: string) {
    if (!content.trim() || !session) return;
    const userMessage: AgentMessage = { role: 'user', content };
    setMessages((m) => [...m, userMessage]);
    setDraft('');
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        content?: string;
        modelChoice?: string;
        error?: string;
      };
      if (!res.ok || !j.content) {
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: j.content!, modelUsed: j.modelChoice ?? null },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Agent reply failed.');
    } finally {
      setSending(false);
    }
  }

  if (!slug) return <p>Missing merchant slug.</p>;
  if (error && !session) {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <h1>Agent unavailable</h1>
        <p style={{ color: '#b91c1c' }}>{error}</p>
        <Link to="/suppliers">← Back to merchant signup</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Integration agent</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 13 }}>
          merchant: <code>{slug}</code>{' '}
          {session && (
            <span style={{ marginLeft: 12 }}>
              · session #{session.id} · {session.messageCount} msgs
            </span>
          )}
        </p>
      </header>

      {escalated && (
        <div
          role="status"
          style={{
            padding: 12,
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: 6,
            marginBottom: 16,
            color: '#92400e',
          }}
        >
          A human escalation has been requested. Vic will follow up via email shortly.
        </div>
      )}

      <div
        ref={scrollRef}
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 12,
          background: 'white',
          height: 480,
          overflowY: 'auto',
          marginBottom: 12,
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: '#6b7280' }}>
            Hi — I'm the PPW integration agent. Tell me about your product catalog and I'll
            propose the easiest connection path (plugin, API, or manual upload).
          </p>
        )}
        {messages.map((m, i) => (
          <article
            key={i}
            style={{
              marginBottom: 12,
              padding: 10,
              background: m.role === 'user' ? '#f3f4f6' : '#eff6ff',
              borderRadius: 6,
            }}
          >
            <strong style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>
              {m.role === 'user' ? 'You' : `Agent${m.modelUsed ? ` · ${m.modelUsed}` : ''}`}
            </strong>
            <div>{renderContent(m.content)}</div>
          </article>
        ))}
        {sending && <p style={{ color: '#6b7280' }}>Agent is thinking…</p>}
      </div>

      {error && (
        <div role="alert" style={{ color: '#b91c1c', marginBottom: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          placeholder="Ask the agent…"
          style={{
            flex: 1,
            padding: 10,
            border: '1px solid #d1d5db',
            borderRadius: 6,
          }}
        />
        <button
          type="button"
          onClick={() => void send(draft)}
          disabled={sending || !draft.trim()}
          style={{
            padding: '0 16px',
            background: '#0a0a0a',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            cursor: sending ? 'wait' : 'pointer',
          }}
        >
          Send
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => void send('Approve and continue with this plan.')}
          disabled={sending || messages.length === 0}
          style={{
            padding: '6px 12px',
            background: '#16a34a',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Approve & continue
        </button>
        <button
          type="button"
          onClick={() => setEscalated(true)}
          disabled={escalated}
          style={{
            padding: '6px 12px',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          I need human help
        </button>
      </div>
    </div>
  );
}
