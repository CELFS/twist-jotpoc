import { normalizeAnalysisContent } from "./analysis-content";
import { z } from "zod";

export const translationModels = { hunyuan: "Hunyuan-MT-7B", qwen: "Qwen3-8B", qwen35: "Qwen3.5-4B" } as const;
export const translationModelSchema = z.enum(["hunyuan", "qwen", "qwen35"]);
export const translationAnalysisModelSchema = z.enum(["qwen", "qwen35"]);
export const TRANSLATION_PROMPT_VERSION = 1;
export const ANALYSIS_PROMPT_VERSION = 5;
const sourceLinkSchema = z.string().max(4096).url().refine((value) => {
  const url = new URL(value);
  return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
});
export const translationAnalysisSchema = z.preprocess(value => normalizeAnalysisContent(value), z.object({
  english: z.object({ explanation: z.string().max(3000), usage: z.array(z.string().min(1).max(600)).max(5) }).strict().optional(),
  vocabulary: z.array(z.object({ term: z.string().min(1).max(80), kind: z.enum(['word', 'phrase', 'abbreviation']), meaning: z.string().min(1).max(120) }).strict()).max(3).optional(),
  explanation: z.string().max(3000),
  usage: z.array(z.string().min(1).max(600)).max(5),
  examples: z.array(z.object({ text: z.string().min(1).max(600), translation: z.string().min(1).max(600) }).strict()).max(3),
}).strict());
export const translationDictionarySchema = z.discriminatedUnion("status", [
  z.object({ status: z.enum(["notRequested", "notFound", "unsupported", "unavailable"]) }).strict(),
  z.object({
    status: z.literal("available"), provider: z.literal("Free Dictionary API"), url: sourceLinkSchema,
    entries: z.array(z.object({
      word: z.string().min(1).max(100), phonetics: z.array(z.string().min(1).max(200)).max(4),
      meanings: z.array(z.object({ partOfSpeech: z.string().max(80), definitions: z.array(z.object({
        definition: z.string().min(1).max(800), example: z.string().max(800).optional(),
      }).strict()).min(1).max(3) }).strict()).min(1).max(4),
      sourceUrls: z.array(sourceLinkSchema).max(3),
      license: z.object({ name: z.string().min(1).max(100), url: sourceLinkSchema }).strict().optional(),
    }).strict()).min(1).max(2),
  }).strict(),
]);
export const translationLearningSchema = z.object({
  dictionary: translationDictionarySchema,
  analysis: z.discriminatedUnion("status", [
    z.object({ status: z.literal("available"), model: translationAnalysisModelSchema, content: translationAnalysisSchema }).strict(),
    z.object({ status: z.enum(["notRequested", "unavailable"]), model: translationAnalysisModelSchema }).strict(),
  ]),
}).strict();
export type TranslationLearning = z.infer<typeof translationLearningSchema>;
const translationInputObject = z.object({
  text: z.string().trim().min(1).max(10000),
  sourceLanguage: z.enum(["en", "zh"]),
  targetLanguage: z.enum(["en", "zh"]),
  model: translationModelSchema,
}).strict();
const differentLanguages = (value: { sourceLanguage: string; targetLanguage: string }) => value.sourceLanguage !== value.targetLanguage;
export const translationInputSchema = translationInputObject.refine(differentLanguages);
// The bundled endpoint remains restricted to the models understood by older Twill releases.
export const legacyTranslationInputSchema = translationInputObject.extend({ model: translationAnalysisModelSchema }).refine(differentLanguages);
export const translationAnalysisInputSchema = translationInputObject.extend({
  model: translationAnalysisModelSchema,
  translatedText: z.string().trim().min(1).max(30000).optional(),
  bilingual: z.boolean().optional(),
}).refine(differentLanguages);
export const translationStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("translation_delta"), text: z.string().max(30000) }).strict(),
  z.object({ type: z.literal("translation_done"), model: translationModelSchema, translatedText: z.string().trim().min(1).max(30000) }).strict(),
  z.object({ type: z.literal("error"), code: z.string().max(100) }).strict(),
]);
const translationRecordObject = translationInputObject.extend({
  id: z.string().regex(/^[A-Za-z0-9_-]{21}$/),
  schemaVersion: z.literal(1),
  originalText: z.string().max(10000),
  translatedText: z.string().trim().min(1).max(30000),
  sourceUrl: z.string().max(4096).url().refine((value) => {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  }).optional(),
  pageTitle: z.string().max(500),
  createdAt: z.number().int().nonnegative(),
  learning: translationLearningSchema.optional(),
}).strict();
export const translationRecordSchema = translationRecordObject.refine(differentLanguages);
export type TranslationInput = z.infer<typeof translationInputSchema>;
export type TranslationRecord = z.infer<typeof translationRecordSchema>;
export type LocalTranslation = TranslationRecord & { savedBy?: string; localSaveFailed?: true; versionRootId?: string; previousVersionId?: string; version?: number };
export type TranslationDictionary = TranslationLearning["dictionary"];
export type TranslationAnalysis = TranslationLearning["analysis"];
export type TranslationAnalysisInput = z.infer<typeof translationAnalysisInputSchema>;
export const savedTranslationAnalysisSchema = z.object({
  id: translationRecordObject.shape.id,
  accountId: z.string().min(1).max(128),
  analysis: z.object({ status: z.literal("available"), model: translationAnalysisModelSchema, content: translationAnalysisSchema }).strict(),
}).strict();
export type TranslationCacheEntry = { key: string; expiresAt: number; value: unknown };
export const translationCursorSchema = z.object({ createdAt: z.number().int().nonnegative(), id: z.string().regex(/^[A-Za-z0-9_-]{21}$/) }).strict();
export const translationSummarySchema = translationRecordObject.pick({ id: true, text: true, translatedText: true, createdAt: true, model: true, pageTitle: true, sourceUrl: true, sourceLanguage: true, targetLanguage: true });
export type TranslationSummary = z.infer<typeof translationSummarySchema>;
