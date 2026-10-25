import { explain as coreExplain, GLOSSARY, type GlossaryEntry } from "@repolens/core/browser";

export const entry = (id: string): GlossaryEntry | null => coreExplain(id);
export const allTerms = (): GlossaryEntry[] => GLOSSARY;
export const labelOf = (id: string): string => coreExplain(id)?.label ?? id;
