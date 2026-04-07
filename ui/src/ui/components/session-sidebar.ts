import { html, nothing, type TemplateResult } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { isCronSessionKey } from "../app-render.helpers.js";
import { icons } from "../icons.ts";
import { isSubagentSessionKey } from "../session-key.js";
import { type GatewaySessionRow, type SessionsListResult } from "../types.ts";

export type SessionSidebarProps = {
  sessions: SessionsListResult | null;
  activeSessionKey: string;
  onSessionSelect: (key: string) => void;
  onNewSession: () => void;
  onClose: () => void;
  sessionSidebarOnSearchChange: (query: string) => void;
  sessionSidebarOnRename: (key: string, newName: string) => Promise<void>;
  sessionSidebarOnDelete: (key: string) => Promise<void>;
  searchQuery?: string;
  loading?: boolean;
  basePath?: string;
  backgroundTasksCollapsed?: boolean;
  onToggleBackgroundTasks?: () => void;
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
    backgroundTasksCollapsed = true,
    onToggleBackgroundTasks,
  } = props;

  const rows = sessions?.sessions ?? [];

  // Filter: show active sessions, or ended sessions that were preserved via /new (have previousSessionKey)
  const showableSessions = rows.filter((row) => {
    // Always show active sessions
    if (!row.endedAt) {
      return true;
    }
    // Show preserved sessions (created via /new)
    if (row.previousSessionKey) {
      return true;
    }
    // Show ended sessions within last 7 days
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const endedAt = row.endedAt ?? 0;
    if (Date.now() - endedAt < sevenDaysMs) {
      return true;
    }
    return false;
  });

  // Apply search filter
  const filteredSessions = searchQuery.trim()
    ? showableSessions.filter((row) => {
        const query = searchQuery.toLowerCase();
        const name = (row.label ?? row.displayName ?? row.key ?? "").toLowerCase();
        return name.includes(query);
      })
    : showableSessions;

  // Split into main sessions and background tasks
  const isBackgroundTask = (row: GatewaySessionRow) =>
    isCronSessionKey(row.key) || isSubagentSessionKey(row.key);

  const mainSessions = filteredSessions.filter((r) => !isBackgroundTask(r));
  const backgroundSessions = filteredSessions.filter(isBackgroundTask);

  // Group main sessions by recency
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const today: GatewaySessionRow[] = [];
  const yesterday: GatewaySessionRow[] = [];
  const older: GatewaySessionRow[] = [];

  for (const row of mainSessions) {
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

  const renderBackgroundTasksSection = () => {
    if (backgroundSessions.length === 0) {
      return nothing;
    }
    return html`
      <div class="session-sidebar__group session-sidebar__background-tasks">
        <button
          class="session-sidebar__section-toggle"
          type="button"
          @click=${onToggleBackgroundTasks}
          title="Toggle Background Tasks section"
        >
          <span class="session-sidebar__section-toggle-icon">
            ${backgroundTasksCollapsed ? icons.chevronRight : icons.chevronDown}
          </span>
          <span class="session-sidebar__section-toggle-label">Background Tasks</span>
          <span class="session-sidebar__section-toggle-badge">${backgroundSessions.length}</span>
        </button>
        ${!backgroundTasksCollapsed
          ? repeat(
              backgroundSessions,
              (row) => row.key,
              (row) => renderSessionItem(row),
            )
          : nothing}
      </div>
    `;
  };

  return html`
    <aside class="session-sidebar" role="navigation" aria-label="Session list">
      <div class="session-sidebar__header">
        <div class="session-sidebar__search">
          <span class="session-sidebar__search-icon">${icons.search}</span>
          <input
            type="text"
            class="session-sidebar__search-input"
            placeholder="Search..."
            .value=${searchQuery}
            @input=${(e: Event) => {
              sessionSidebarOnSearchChange((e.target as HTMLInputElement).value);
            }}
          />
          ${searchQuery
            ? html`
                <button
                  class="session-sidebar__search-clear"
                  type="button"
                  @click=${() => {
                    sessionSidebarOnSearchChange("");
                  }}
                  aria-label="Clear search"
                >
                  ${icons.x}
                </button>
              `
            : nothing}
        </div>
        <button
          class="session-sidebar__close"
          type="button"
          @click=${onClose}
          aria-label="Close sidebar"
        >
          ${icons.x}
        </button>
      </div>

      <div class="session-sidebar__content">
        ${loading
          ? html` <div class="session-sidebar__loading">${icons.loader} Loading sessions...</div> `
          : nothing}
        ${filteredSessions.length === 0 && !loading
          ? html`
              <div class="session-sidebar__empty">
                ${searchQuery ? "No sessions match your search" : "No sessions found"}
              </div>
            `
          : nothing}
        ${renderGroup("Today", today)} ${renderGroup("Yesterday", yesterday)}
        ${renderGroup("Older", older)} ${renderBackgroundTasksSection()}
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
