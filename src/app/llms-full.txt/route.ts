import { llmsTxt, textResponse } from '@/content/llms';

/** llms.txt with every answer and project written out. Made at build time. */
export const dynamic = 'force-static';

export function GET() {
  return textResponse(llmsTxt(true));
}
