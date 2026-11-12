import { assistantModels, isAssistantModel } from "@/assistant/models";

const modelIcons: Readonly<Record<string, string>> = {
  glm: "/icons/models/zhipu.svg",
  "glm-4.7-flash": "/icons/models/zhipu.svg",
  qwen: "/icons/models/qwen.svg",
  "qwen3-8b": "/icons/models/qwen.svg",
  "qwen/qwen3-8b": "/icons/models/qwen.svg",
  "xingchenagi/xing4.0-29b": "/icons/models/teleai.svg",
  "thudm/glm-4-9b-0414": "/icons/models/zhipu.svg",
  "thudm/glm-z1-9b-0414": "/icons/models/zhipu.svg",
  "qwen/qwen3.5-4b": "/icons/models/qwen.svg",
  "deepseek-ai/deepseek-r1-0528-qwen3-8b": "/icons/models/deepseek.svg",
  "deepseek-ai/deepseek-v4-flash": "/icons/models/deepseek.svg",
  "deepseek-ai/deepseek-v3.2": "/icons/models/deepseek.svg",
  "qwen/qwen2.5-7b-instruct": "/icons/models/qwen.svg",
  "tencent/hunyuan-mt-7b": "/icons/models/hunyuan.svg",
  "mistral-small-latest": "/icons/models/mistral.svg",
};

export function AssistantModelIcon({ model }: { model: string }) {
  const src = modelIcons[(isAssistantModel(model)?assistantModels[model].id:model).toLowerCase()];

  return src ? (
    <img className="assistant-model-icon" src={src} alt="" width={16} height={16} />
  ) : null;
}
