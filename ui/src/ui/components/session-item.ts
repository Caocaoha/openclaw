import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../icons.ts";
import type { GatewaySessionRow } from "../types.ts";

export type SessionItemProps = {
  session: GatewaySessionRow;
  isActive: boolean;
  onSelect: (key: string) => void;
  onRename?: (key: string, newName: string) => Promise<void>;
  onDelete?: (key: string) => Promise<void>;
  basePath?: string;
};

export function renderSessionItem(props: SessionItemProps): TemplateResult {
  const { session, isActive, onSelect, onRename, onDelete } = props;
  const used = session.totalTokens ?? 0;
  const limit = session.contextTokens ?? 0;
  const pct = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;

  const contextColor = pct >= 85 ? "var(--danger)" : pct >= 60 ? "var(--warn)" : "var(--ok)";
  const contextWidth = `${Math.max(pct, 5)}%`;

  const displayName = session.displayName ?? session.label ?? session.key ?? "Session";

  const updatedAt = session.updatedAt ? formatRelativeTime(session.updatedAt) : "Unknown";

  return html`
    <button
      class="session-sidebar-item ${isActive ? "session-sidebar-item--active" : ""}"
      type="button"
      role="option"
      aria-selected=${isActive}
      @click=${() => onSelect(session.key)}
      title=${displayName}
    >
      <div class="session-sidebar-item__icon">${isActive ? icons.check : icons.circle}</div>
      <div class="session-sidebar-item__content">
        <div class="session-sidebar-item__name" data-session-key=${session.key}>${displayName}</div>
        <div class="session-sidebar-item__meta">
          <span class="session-sidebar-item__updated">${updatedAt}</span>
          ${session.model
            ? html`<span class="session-sidebar-item__model">${session.model}</span>`
            : nothing}
        </div>
      </div>
      <div class="session-sidebar-item__context" title="Context usage: ${pct}%">
        <div
          class="session-sidebar-item__context-bar"
          style="width: ${contextWidth}; background: ${contextColor}"
        ></div>
      </div>
      ${onRename || onDelete
        ? html`
            <div class="session-sidebar-item__actions">
              ${onRename
                ? html`
                    <button
                      class="session-sidebar-item__action-btn"
                      type="button"
                      title="Rename session"
                      @click=${async (e: Event) => {
                        e.stopPropagation();
                        const newName = prompt("Rename session:", displayName);
                        if (newName !== null && newName.trim() !== displayName) {
                          await onRename(session.key, newName.trim());
                        }
                      }}
                    >
                      ${icons.edit}
                    </button>
                  `
                : nothing}
              ${onDelete
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
                          await onDelete(session.key);
                        }
                      }}
                    >
                      ${icons.trash}
                    </button>
                  `
                : nothing}
            </div>
          `
        : nothing}
    </button>
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
