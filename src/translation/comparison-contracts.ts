import { z } from 'zod';

export const comparisonLanguages = ['fr', 'es', 'ru', 'ar'] as const;
export type ComparisonLanguage = typeof comparisonLanguages[number];
export const comparisonInputSchema = z.object({
  text: z.string().trim().min(1).max(10000), sourceLanguage: z.enum(['en', 'zh']),
  language: z.enum(comparisonLanguages), model: z.enum(['qwen', 'qwen35']),
}).strict();
export const comparisonResultSchema = z.object({
  language: z.enum(comparisonLanguages), model: z.enum(['qwen', 'qwen35']),
  translatedText: z.string().trim().min(1).max(30000), grammar: z.string().trim().min(1).max(1200),
}).strict();
export type ComparisonInput = z.infer<typeof comparisonInputSchema>;
export type ComparisonResult = z.infer<typeof comparisonResultSchema>;
