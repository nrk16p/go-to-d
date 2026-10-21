// Vendored from Sir-Teo/web-katrain (MIT), see LICENSES/web-katrain.txt

export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase}${trimmedPath}`;
}
