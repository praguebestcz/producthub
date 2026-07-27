import { getAppUrl } from "@/lib/env";
import {
  notificationMessage,
  type NotificationKind,
} from "@/lib/notifications/labels";

// Sestavení e-mailu z notifikací (server-only - potřebuje absolutní APP_URL).
// Jedna položka = konkrétní e-mail; víc položek (seskupení v režimu „jen
// nepřečtené") = souhrnný e-mail. Veškerý uživatelský text se escapuje (jména,
// úryvky) - obrana proti HTML injection do e-mailu.

export type NotificationEmailItem = {
  kind: NotificationKind;
  actorName: string;
  projectName: string;
  documentName: string | null;
  snippet: string; // už oříznutý; skládá se AŽ po re-checku viditelnosti
  projectId: number;
  documentId: number | null;
  rootCommentId: number | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Cílový odkaz notifikace: přímo na komentář v dokumentu, jinak na projekt.
function itemUrl(base: string, it: NotificationEmailItem): string {
  if (it.documentId) {
    const q = it.rootCommentId ? `?comment=${it.rootCommentId}` : "";
    return `${base}/projects/${it.projectId}/documents/${it.documentId}${q}`;
  }
  return `${base}/projects/${it.projectId}`;
}

function renderItem(base: string, it: NotificationEmailItem): string {
  const url = itemUrl(base, it);
  const where = it.documentName
    ? `${escapeHtml(it.projectName)} › ${escapeHtml(it.documentName)}`
    : escapeHtml(it.projectName);
  const snippet = it.snippet.trim()
    ? `<p style="margin:6px 0 0;color:#666;font-style:italic;">${escapeHtml(
        it.snippet,
      )}</p>`
    : "";
  return `
    <table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 12px;">
      <tr>
        <td style="padding:14px 16px;border:1px solid #e5e5e5;border-radius:10px;">
          <p style="margin:0;font-size:15px;color:#111;">
            <strong>${escapeHtml(it.actorName)}</strong>
            <span style="color:#555;">${escapeHtml(
              notificationMessage(it.kind),
            )}</span>
          </p>
          <p style="margin:4px 0 0;font-size:13px;color:#888;">${where}</p>
          ${snippet}
          <p style="margin:10px 0 0;">
            <a href="${url}" style="display:inline-block;padding:8px 14px;background:#e5312b;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;">Otevřít komentář</a>
          </p>
        </td>
      </tr>
    </table>`;
}

export function buildNotificationEmail(items: NotificationEmailItem[]): {
  subject: string;
  html: string;
} {
  const base = getAppUrl();
  const settingsUrl = `${base}/nastaveni`;

  const subject =
    items.length === 1
      ? `${items[0].actorName} ${notificationMessage(items[0].kind)} - ${
          items[0].projectName
        }`
      : `${items.length} nových upozornění - ProductHub`;

  const heading =
    items.length === 1
      ? "Nové upozornění"
      : `Máte ${items.length} nových upozornění`;

  const body = items.map((it) => renderItem(base, it)).join("");

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;color:#111;">
    <p style="margin:0 0 4px;font-size:18px;font-weight:700;">${escapeHtml(
      heading,
    )}</p>
    <p style="margin:0 0 18px;font-size:13px;color:#888;">ProductHub - připomínkování specifikací</p>
    ${body}
    <p style="margin:22px 0 0;font-size:12px;color:#aaa;border-top:1px solid #eee;padding-top:14px;">
      Tento e-mail chodí podle vašeho nastavení upozornění.
      <a href="${settingsUrl}" style="color:#888;">Změnit nastavení</a>.
    </p>
  </div>`;

  return { subject, html };
}
