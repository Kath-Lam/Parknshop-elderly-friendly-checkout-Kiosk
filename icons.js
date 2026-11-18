const paths = {
  card: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20M6 15h4"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  home: '<path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/>',
  remove: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  bag: '<path d="M5 8h14l2 13H3L5 8Z M8 9V6a4 4 0 0 1 8 0v3"/>',
  scan: '<path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5M7 7v10m3-10v10m3-10v10m4-10v10M1 12h22"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  berries: '<circle cx="8" cy="14" r="5" fill="#596baf"/><circle cx="16" cy="15" r="5" fill="#40508c"/><circle cx="12" cy="8" r="5" fill="#7185bf"/><path d="m12 3 2-2m-4 6 2 2 2-2" stroke="#243968"/>',
  milk: '<path d="m7 2 10 0-2 5 4 4v11H5V7l2-5Z" fill="#f5f7f2"/><path d="M5 11h14v8H5" fill="#77b3cf"/><path d="M7 2 9 7h6M9 7v4"/>',
  bread: '<path d="M5 9C0 6 5 2 12 2s12 4 7 7v12H5V9Z" fill="#d8aa67"/><path d="M8 10v7m4-8v8m4-7v7" stroke="#ae8048"/>',
  orange: '<circle cx="12" cy="14" r="9" fill="#ed9c35"/><path d="M12 5V2m0 2c3-5 9-3 8-2-1 3-5 4-8 2" fill="#71a84d"/>',
};
export function icon(key) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key] || paths.scan}</svg>`; }
