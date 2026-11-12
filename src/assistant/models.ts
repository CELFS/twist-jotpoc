// Keep this catalog aligned with the companion project's src/assistant/models.ts.
export const assistantModels = {
  glm: { id: "glm-4.7-flash", label: "GLM-4.7-Flash", provider: "zhipu", tools: true, thinking: "zhipu", translation: false },
  qwen: { id: "Qwen/Qwen3-8B", label: "Qwen3-8B", provider: "siliconflow", tools: true, thinking: "switch", translation: false },
  xing: { id: "XingChenAGI/Xing4.0-29B", label: "Xing4.0-29B", provider: "siliconflow", tools: true, thinking: "switch", translation: false },
  // glm4: { id: "THUDM/GLM-4-9B-0414", label: "GLM-4-9B-0414", provider: "siliconflow", tools: true, thinking: "default", translation: false },
  // glmz1: { id: "THUDM/GLM-Z1-9B-0414", label: "GLM-Z1-9B-0414", provider: "siliconflow", tools: true, thinking: "default", translation: false },
  qwen25: { id: "Qwen/Qwen2.5-7B-Instruct", label: "Qwen2.5-7B-Instruct", provider: "siliconflow", tools: true, thinking: "default", translation: false },
  qwen35: { id: "Qwen/Qwen3.5-4B", label: "Qwen3.5-4B", provider: "siliconflow", tools: true, thinking: "switch", translation: false },
  deepseek: { id: "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B", label: "DeepSeek-R1-0528-Qwen3-8B", provider: "siliconflow", tools: false, thinking: "switch", translation: false },
  hunyuan: { id: "tencent/Hunyuan-MT-7B", label: "Hunyuan-MT-7B", provider: "siliconflow", tools: false, thinking: "default", translation: true },
  // deepseekV4: { id: "deepseek-ai/DeepSeek-V4-Flash", label: "DeepSeek-V4-Flash", provider: "siliconflow", tools: true, thinking: "switch", translation: false },
  // deepseekV32: { id: "deepseek-ai/DeepSeek-V3.2", label: "DeepSeek-V3.2", provider: "siliconflow", tools: true, thinking: "switch", translation: false },
  mistral: { id: "mistral-small-latest", label: "Mistral Small", provider: "mistral", tools: true, thinking: "mistral", translation: false },
} as const;
export type AssistantModel = keyof typeof assistantModels;
export const assistantModelKeys = Object.keys(assistantModels) as AssistantModel[];
export const assistantModelIds = assistantModelKeys.map(key => assistantModels[key].id);
export function isAssistantModel(value: unknown): value is AssistantModel {
  return typeof value === "string" && Object.hasOwn(assistantModels, value);
}
