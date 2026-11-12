/**
 * Native share sheet on phones (the trade-fair use case), clipboard elsewhere.
 * Resolves to what happened so the caller can give feedback.
 */
export async function shareLink(url: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ url, title });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
