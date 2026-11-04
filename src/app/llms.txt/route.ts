import { llmsTxt, textResponse } from '@/content/llms';

/** Who Ryhox is, for language models (llmstxt.org). Made at build time. */
export const dynamic = 'force-static';

export function GET() {
  return textResponse(llmsTxt());
}
