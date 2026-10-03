/* The official roster sheet as a PDF (legacy js/pdf.js): core fills the
   template with pdf-lib. Both are loaded only when a sheet is made – the
   library is large, and most visits never need it. */
import * as core from '@mordheim/core';

// the template lives once in the repository (assets/), for the Roster Builder and the app
const TEMPLATE = new URL('../../../assets/sheet.pdf', import.meta.url).href;

export async function officialSheet(ctx: core.Ctx): Promise<{ bytes: Uint8Array; filename: string }> {
  const [lib, res] = await Promise.all([import('pdf-lib'), fetch(TEMPLATE)]);
  if (!res.ok) throw new Error(`the sheet template could not be loaded (${res.status})`);
  const template = new Uint8Array(await res.arrayBuffer());
  return core.buildOfficialSheet(ctx, lib as unknown as core.PdfLib, template);
}
