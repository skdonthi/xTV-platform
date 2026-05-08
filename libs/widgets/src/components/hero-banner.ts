import type { WidgetRenderInput } from "../index";

export function createHeroBannerElement(input: WidgetRenderInput): HTMLElement {
  const element = document.createElement("article");
  const title = readString(input.props.title, "Welcome");
  const subtitle = readString(input.props.subtitle, "");
  const image = readString(input.props.image, "");

  element.dataset.widgetId = input.id;
  element.dataset.widgetType = "hero-banner";
  element.tabIndex = 0;
  element.className = "xtv-widget xtv-hero-banner";
  element.style.backgroundImage = image
    ? `linear-gradient(90deg, #000 0%, transparent 70%), url(${image})`
    : "";
  element.innerHTML = `
    <div class="xtv-hero-copy">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
      <small>${escapeHtml(input.context.customer)} | ${escapeHtml(input.context.platform)}</small>
    </div>
  `;

  return element;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
