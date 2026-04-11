import { html, nothing, type TemplateResult } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { icons } from "../icons.ts";
import { type GatewaySessionRow, type SessionsListResult } from "../types.ts";

export type SessionSidebarProps = {
  sessions: SessionsListResult | null;
  activeSessionKey: string;
  onSessionSelect: (key: string) => void;
  onNewSession: () => void;
  onClose: () => void;
  sessionSidebarOnSearchChange?: (query: string) => void;
  sessionSidebarOnRename?: (key: string, newName: string) => Promise<void>;
  sessionSidebarOnDelete?: (key: string) => Promise<void>;
  searchQuery?: string;
  loading?: boolean;
  basePath?: string;
};

export function renderSessionSidebar(props: SessionSidebarProps): TemplateResult {
  const {
    sessions,
    activeSessionKey,
    onSessionSelect,
    onNewSession,
    onClose,
    sessionSidebarOnSearchChange,
    sessionSidebarOnRename,
    sessionSidebarOnDelete,
    searchQuery = "",
    loading,
  } = props;

  const rows = sessions?.sessions ?? [];

  const showableSessions = rows.filter((row) => {
    if (!row.endedAt) {
      return true;
    }
    if (row.previousSessionKey) {
      return true;
    }
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const endedAt = row.endedAt ?? 0;
    if (Date.now() - endedAt < sevenDaysMs) {
      return true;
    }
    return false;
  });

  const filteredSessions = searchQuery.trim()
    ? showableSessions.filter((row) => {
        const query = searchQuery.toLowerCase();
        const name = (row.label ?? row.displayName ?? row.key ?? "").toLowerCase();
        return name.includes(query);
      })
    : showableSessions;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const today: GatewaySessionRow[] = [];
  const yesterday: GatewaySessionRow[] = [];
  const older: GatewaySessionRow[] = [];

  for (const row of filteredSessions) {
    const ts = row.updatedAt ?? 0;
    if (!ts) {
      older.push(row);
    } else if (now - ts < dayMs) {
      today.push(row);
    } else if (now - ts < 2 * dayMs) {
      yesterday.push(row);
    } else {
      older.push(row);
    }
  }

  const renderSessionItem = (row: GatewaySessionRow): TemplateResult => {
    const isActive = row.key === activeSessionKey;
    const used = row.totalTokens ?? 0;
    const limit = row.contextTokens ?? 0;
    const pct = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;
    const contextColor = pct >= 85 ? "var(--danger)" : pct >= 60 ? "var(--warn)" : "var(--ok)";
    const contextWidth = `${Math.max(pct, 5)}%`;
    const displayName = row.label ?? row.displayName ?? row.key ?? "Session";
    const updatedAt = row.updatedAt ? formatRelativeTime(row.updatedAt) : "Unknown";

    return html`
      <div
        class="session-sidebar-item ${isActive ? "session-sidebar-item--active" : ""}"
        role="option"
        tabindex="0"
        aria-selected=${isActive}
        @click=${() => onSessionSelect(row.key)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSessionSelect(row.key);
          }
        }}
        title=${displayName}
      >
        <div class="session-sidebar-item__icon">${isActive ? icons.check : icons.circle}</div>
        <div class="session-sidebar-item__content">
          <div class="session-sidebar-item__name">${displayName}</div>
          <div class="session-sidebar-item__meta">
            <span class="session-sidebar-item__updated">${updatedAt}</span>
            ${row.model
              ? html`<span class="session-sidebar-item__model">${row.model}</span>`
              : nothing}
          </div>
        </div>
        <div class="session-sidebar-item__context" title="Context usage: ${pct}%">
          <div
            class="session-sidebar-item__context-bar"
            style="width: ${contextWidth}; background: ${contextColor}"
          ></div>
        </div>
        <div class="session-sidebar-item__actions">
          ${sessionSidebarOnRename
            ? html`
                <button
                  class="session-sidebar-item__action-btn"
                  type="button"
                  title="Rename session"
                  @click=${async (e: Event) => {
                    e.stopPropagation();
                    const newName = prompt("Rename session:", displayName);
                    if (newName !== null && newName.trim() !== displayName) {
                      await sessionSidebarOnRename(row.key, newName.trim());
                    }
                  }}
                >
                  ${icons.edit}
                </button>
              `
            : nothing}
          ${sessionSidebarOnDelete
            ? html`
                <button
                  class="session-sidebar-item__action-btn session-sidebar-item__action-btn--delete"
                  type="button"
                  title="Delete session"
                  @click=${async (e: Event) => {
                    e.stopPropagation();
                    const confirmed = confirm(
                      `Delete session "${displayName}"?\n\nThis will archive the transcript and cannot be undone.`,
                    );
                    if (confirmed) {
                      await sessionSidebarOnDelete(row.key);
                    }
                  }}
                >
                  ${icons.trash}
                </button>
              `
            : nothing}
        </div>
      </div>
    `;
  };

  const renderGroup = (label: string, items: GatewaySessionRow[]) => {
    if (items.length === 0) {
      return nothing;
    }
    return html`
      <div class="session-sidebar__group">
        <div class="session-sidebar__group-label">${label}</div>
        ${repeat(
          items,
          (row) => row.key,
          (row) => renderSessionItem(row),
        )}
      </div>
    `;
  };

  return html`
    <aside class="session-sidebar" role="navigation" aria-label="Session list">
      <div class="session-sidebar__header">
        <h2 class="session-sidebar__title">Sessions</h2>
        <button
          class="session-sidebar__close"
          type="button"
          aria-label="Close session sidebar"
          @click=${onClose}
        >
          ${icons.x}
        </button>
      </div>

      <div class="session-sidebar__search">
        <input
          type="text"
          class="session-sidebar__search-input"
          placeholder="Search sessions..."
          .value=${searchQuery}
          @input=${(e: Event) => {
            const target = e.target as HTMLInputElement;
            sessionSidebarOnSearchChange?.(target.value);
          }}
        />
      </div>

      <div class="session-sidebar__content">
        ${loading
          ? html` <div class="session-sidebar__loading">${icons.loader} Loading sessions...</div> `
          : nothing}
        ${filteredSessions.length === 0 && !loading
          ? html` <div class="session-sidebar__empty">No sessions found</div> `
          : nothing}
        ${renderGroup("Today", today)} ${renderGroup("Yesterday", yesterday)}
        ${renderGroup("Older", older)}
      </div>

      <div class="session-sidebar__footer">
        <button
          class="session-sidebar__new-btn"
          type="button"
          @click=${onNewSession}
          title="New session"
        >
          ${icons.plus}
          <span>New Chat</span>
        </button>
      </div>
    </aside>
  `;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return "Just now";
}
