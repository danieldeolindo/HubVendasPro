/* ============================================================
   HubVendasPro — sistema de ícones (SVG inline, estilo outline)
   Substitui os emojis por ícones com identidade visual própria.
   ============================================================ */
const ICON_PATHS = {
  "eye": `<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`,
  "eye-off": `<path d="M6.4 6.6C4 8.1 2 12 2 12s4 7 10 7c1.8 0 3.4-.4 4.8-1.1M9.9 4.2A10.6 10.6 0 0 1 12 4c6 0 10 7 10 7a17.7 17.7 0 0 1-2.4 3.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><line x1="3" y1="3" x2="21" y2="21"/>`,
  "log-out": `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`,
  "x": `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  "clipboard": `<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="15" y2="15"/>`,
  "users": `<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.3"/><path d="M15.8 14c2.5.3 4.2 2.4 4.2 6"/>`,
  "settings": `<circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V19a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,
  "arrow-right": `<line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/>`,
  "search": `<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
  "cart": `<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 7H6"/>`,
  "trash": `<line x1="4" y1="7" x2="20" y2="7"/><path d="M6 7V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>`,
  "cash": `<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><line x1="6" y1="10" x2="6" y2="10.01"/><line x1="18" y1="14" x2="18" y2="14.01"/>`,
  "card": `<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>`,
  "zap": `<polygon points="13 2 4 14 11 14 10 22 20 10 13 10 13 2"/>`,
  "check": `<polyline points="20 6 9 17 4 12"/>`,
  "camera": `<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="14" r="3.5"/>`,
  "file-text": `<path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><polyline points="15 2 15 7 20 7"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>`,
  "download": `<path d="M12 3v12"/><polyline points="7 11 12 16 17 11"/><path d="M4 19h16"/>`,
  "check-square": `<rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="8 12 11 15 16 9"/>`,
  "square": `<rect x="3" y="3" width="18" height="18" rx="2"/>`,
  "bell": `<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>`,
  "bell-off": `<path d="M6 9c0 5-2 6-2 6h11"/><path d="M10 20a2 2 0 0 0 4 0"/><path d="M9.3 5.2A6 6 0 0 1 18 9c0 2.4.4 4 .9 5"/><line x1="2" y1="2" x2="22" y2="22"/>`,
  "store": `<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v10a1 1 0 0 0 1 1h4v-6h6v6h4a1 1 0 0 0 1-1V9"/><line x1="3" y1="9" x2="21" y2="9"/>`,
  "palette": `<path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.2 0-1.1.9-2 2-2H17a4 4 0 0 0 4-4c0-4.4-4-7.5-9-7.5z"/><circle cx="7" cy="12" r="1"/><circle cx="9" cy="8" r="1"/><circle cx="14" cy="7.5" r="1"/><circle cx="17" cy="10.5" r="1"/>`,
  "sun": `<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/>`,
  "moon": `<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>`,
  "menu": `<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>`,
  "rotate-ccw": `<path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 8 8 8"/>`,
  "lock": `<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  "printer": `<path d="M6 8V3h12v5"/><rect x="4" y="8" width="16" height="8" rx="1"/><path d="M6 16h12v5H6z"/>`,
  "share": `<circle cx="6" cy="12" r="2.3"/><circle cx="18" cy="6" r="2.3"/><circle cx="18" cy="18" r="2.3"/><line x1="8.1" y1="10.8" x2="15.9" y2="7.2"/><line x1="8.1" y1="13.2" x2="15.9" y2="16.8"/>`,
  "edit": `<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`,
  "save": `<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 3v5h8V3"/><path d="M7 13h10v7H7z"/>`,
  "package": `<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v9l9 5 9-5V8"/><line x1="12" y1="13" x2="12" y2="22"/>`,
  "bar-chart": `<line x1="5" y1="21" x2="5" y2="12"/><line x1="12" y1="21" x2="12" y2="7"/><line x1="19" y1="21" x2="19" y2="15"/><line x1="3" y1="21" x2="21" y2="21"/>`,
  "signal": `<circle cx="12" cy="19" r="1.3"/><path d="M8.5 15.8a5 5 0 0 1 7 0"/><path d="M5.3 12.6a9.3 9.3 0 0 1 13.4 0"/><path d="M2.2 9.4a13.6 13.6 0 0 1 19.6 0"/>`,
  "check-circle": `<circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9"/>`,
  "alert-triangle": `<path d="M10.6 3.9 1.8 19a1.6 1.6 0 0 0 1.4 2.4h17.6a1.6 1.6 0 0 0 1.4-2.4L13.4 3.9a1.6 1.6 0 0 0-2.8 0z"/><line x1="12" y1="9.5" x2="12" y2="14"/><line x1="12" y1="17" x2="12" y2="17.01"/>`,
  "smartphone": `<rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>`,
  "phone": `<path d="M5 4h3l2 5-2.3 1.6a11 11 0 0 0 4.7 4.7L14 13l5 2v3a2 2 0 0 1-2.2 2A15 15 0 0 1 3 6.2 2 2 0 0 1 5 4z"/>`,
  "id-card": `<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><line x1="13" y1="10" x2="19" y2="10"/><line x1="13" y1="14" x2="19" y2="14"/>`,
  "mail": `<rect x="2" y="5" width="20" height="14" rx="2"/><polyline points="2 6 12 13 22 6"/>`,
  "map-pin": `<path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.3"/>`,
  "user": `<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>`,
  "wallet": `<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5"/><circle cx="16" cy="14" r="1.3"/>`,
  "trending-up": `<polyline points="3 17 9 11 13 15 21 6"/><polyline points="15 6 21 6 21 12"/>`,
  "target": `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r="1"/>`,
  "x-circle": `<circle cx="12" cy="12" r="9"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>`,
  "tag": `<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7" cy="7" r="1.4"/>`,
  "hash": `<line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/><line x1="10" y1="4" x2="8" y2="20"/><line x1="16" y1="4" x2="14" y2="20"/>`,
  "ban": `<circle cx="12" cy="12" r="9"/><line x1="5.5" y1="5.5" x2="18.5" y2="18.5"/>`,
  "message-circle": `<path d="M4 12a8 8 0 1 1 3 6.2L3 20l1.4-3.8A7.9 7.9 0 0 1 4 12z"/>`,
  "grip": `<circle cx="9" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="15" cy="18" r="1.2"/>`
};

function ic(name, cls) {
  const p = ICON_PATHS[name];
  if (!p) return "";
  return `<svg class="icon${cls ? " " + cls : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
window.ic = ic;
