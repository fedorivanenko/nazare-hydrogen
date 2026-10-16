/**
 * Prototype adapter for search cards backed by portable-text content.
 *
 * The query projection is kept alongside the adapter so its response shape
 * can be reviewed without depending on a running Sanity instance.
 */
export const SEARCH_CARD_PROJECTION = `
  *[_type in ["article", "guide", "news"]] {
    _id,
    title,
    "bodyText": pt::text(body[_type == "block"][0...3])
  }
`;

export interface SearchCardDocument {
  _id: string;
  title: string;
  bodyText: string;
}

export interface SearchCard {
  id: string;
  title: string;
  excerpt: string | null;
}

function excerptFromText(text: string): string | null {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  return normalized.length > 180
    ? `${normalized.slice(0, 177)}...`
    : normalized;
}

export function mapSearchCards(documents: SearchCardDocument[]): SearchCard[] {
  return documents.map((document) => ({
    id: document._id,
    title: document.title,
    excerpt: excerptFromText(document.bodyText),
  }));
}
