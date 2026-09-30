/**
 * Safe URL Fragment & Hash Management
 * RFC 3986 ensures that fragments (anything following '#') are NEVER transmitted to the server in HTTP requests.
 */

export interface ParsedShareLink {
  fileId: string | null;
  keyString: string | null;
  hasPassword?: boolean;
}

/**
 * Builds the zero-knowledge shareable URL.
 * Format: {origin}/#file/{fileId}#k={keyString}&pw={0|1}
 */
export function buildShareUrl(fileId: string, keyString: string, hasPassword: boolean = false): string {
  const origin = window.location.origin;
  const hashPayload = new URLSearchParams({
    k: keyString,
    ...(hasPassword ? { pw: '1' } : {}),
  }).toString();

  return `${origin}/#file/${fileId}#${hashPayload}`;
}

/**
 * Parses current window.location to extract fileId and secret key.
 */
export function parseCurrentUrl(): ParsedShareLink {
  const hash = window.location.hash; // e.g. "#file/123#k=xyz&pw=1" or "#/file/123#k=xyz"
  const pathname = window.location.pathname;

  let fileId: string | null = null;
  let keyString: string | null = null;
  let hasPassword = false;

  // Case 1: Hash-based routing e.g. #file/123#k=xyz or #/file/123#k=xyz
  if (hash) {
    const parts = hash.split('#').filter(Boolean); // e.g. ["file/123", "k=xyz&pw=1"]
    
    for (const part of parts) {
      if (part.startsWith('file/') || part.startsWith('/file/')) {
        fileId = part.replace(/^\/?file\//, '');
      } else if (part.includes('k=')) {
        const params = new URLSearchParams(part);
        keyString = params.get('k');
        hasPassword = params.get('pw') === '1';
      }
    }
  }

  // Case 2: Path-based URL e.g. /file/123#k=xyz
  if (!fileId && pathname.includes('/file/')) {
    const match = pathname.match(/\/file\/([a-zA-Z0-9_-]+)/);
    if (match) {
      fileId = match[1];
    }
    if (hash) {
      const cleanHash = hash.replace(/^#/, '');
      const params = new URLSearchParams(cleanHash);
      if (params.has('k')) {
        keyString = params.get('k');
        hasPassword = params.get('pw') === '1';
      }
    }
  }

  return { fileId, keyString, hasPassword };
}
