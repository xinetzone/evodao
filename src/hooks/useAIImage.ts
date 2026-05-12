import { useCallback, useState } from "react";
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  createClient,
} from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

export interface GeneratedImage {
  url: string;
  meta_data?: Record<string, unknown>;
}

export interface GenerateImageOptions {
  model: string;
  prompt: string;
  type?: "txt_2_img" | "img_2_img";
  resource_path?: string;
  refer_image_resource_paths?: string[];
  ratio?: string;
  resolution?: string;
  format?: string;
}

interface SubmitResponse {
  success: boolean;
  task_id?: string;
  status?: "processing";
  message?: string;
  code?: string;
}

interface TaskStatusResponse {
  task_id: string;
  status: "processing" | "succeed" | "failed";
  images?: GeneratedImage[];
  error?: string;
}

const FALLBACK_MESSAGES: Record<string, string> = {
  authentication_error: "认证失败，请刷新页面。",
  rate_limit_error: "请求过于频繁，请稍后再试。",
  invalid_request_error: "请求无效，请重试。",
  overloaded_error: "服务繁忙，请稍后再试。",
  insufficient_credits: "AI 额度已耗尽，请联系管理员。",
  permission_error: "AI 功能未启用，请联系管理员。",
  api_error: "服务暂时不可用。",
  not_found_error: "资源不存在。",
  internal_error: "内部错误，请稍后再试。",
  configuration_error: "AI 服务未配置。",
};

function getUserMessage(code?: string, backendMessage?: string): string {
  if (backendMessage) return backendMessage;
  if (code) return FALLBACK_MESSAGES[code] || "服务暂时不可用。";
  return "服务暂时不可用。";
}

async function downloadImageFile(url: string, filename: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

export function useAIImage() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvokeError = useCallback(async (invokeError: unknown) => {
    if (invokeError instanceof FunctionsHttpError) {
      const errorBody = await invokeError.context.json().catch(() => ({}));
      throw new Error(getUserMessage((errorBody as Record<string, string>).code, (errorBody as Record<string, string>).message));
    }
    if (invokeError instanceof FunctionsRelayError) {
      throw new Error("网络连接错误，请检查网络后重试。");
    }
    if (invokeError instanceof FunctionsFetchError) {
      throw new Error("网络请求失败，请稍后再试。");
    }
    if (invokeError instanceof Error) throw invokeError;
    throw new Error("网络请求失败");
  }, []);

  const submit = useCallback(async (options: GenerateImageOptions) => {
    setError(null);
    setImages([]);
    setTaskId(null);
    setIsSubmitting(true);

    try {
      const image_option: Record<string, string> = {};
      if (options.ratio) image_option.ratio = options.ratio;
      if (options.resolution) image_option.resolution = options.resolution;
      if (options.format) image_option.format = options.format;

      const { data, error: invokeError } = await supabase.functions.invoke<SubmitResponse>(
        "ai-image-submit-8f02c91ef078",
        {
          body: {
            model: options.model,
            prompt: options.prompt,
            type: options.type ?? "txt_2_img",
            resource_path: options.resource_path,
            refer_image_resource_paths: options.refer_image_resource_paths,
            image_option,
          },
        }
      );

      if (invokeError) await handleInvokeError(invokeError);
      if (!data?.success || !data.task_id) {
        throw new Error(getUserMessage(data?.code, data?.message || "图像生成失败"));
      }

      setTaskId(data.task_id);
      return data.task_id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "提交图像生成失败";
      setError(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [handleInvokeError, supabase]);

  const poll = useCallback(async (currentTaskId: string, maxAttempts = 60) => {
    setError(null);
    setIsPolling(true);

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { data, error: invokeError } = await supabase.functions.invoke<TaskStatusResponse>(
          "ai-image-status-8f02c91ef078",
          { body: { task_id: currentTaskId } }
        );

        if (invokeError) await handleInvokeError(invokeError);
        if (!data) throw new Error("未获取到任务状态");
        if (data.status === "failed") throw new Error(data.error || "图像生成失败");
        if (data.status === "succeed") {
          const nextImages = data.images || [];
          setImages(nextImages);
          return nextImages;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      throw new Error("图像生成超时，请重试");
    } catch (err) {
      const message = err instanceof Error ? err.message : "轮询图像生成状态失败";
      setError(message);
      return null;
    } finally {
      setIsPolling(false);
    }
  }, [handleInvokeError, supabase]);

  const submitAndPoll = useCallback(async (options: GenerateImageOptions) => {
    const nextTaskId = await submit(options);
    if (!nextTaskId) return null;
    return poll(nextTaskId);
  }, [poll, submit]);

  const downloadImage = useCallback(async (index: number, customFilename?: string) => {
    if (index < 0 || index >= images.length) throw new Error("Invalid image index");
    const filename = customFilename || `evodao-image-${Date.now()}-${index + 1}.png`;
    await downloadImageFile(images[index].url, filename);
  }, [images]);

  const downloadAllImages = useCallback(async (filenamePrefix?: string) => {
    const prefix = filenamePrefix || `evodao-image-${Date.now()}`;
    for (let i = 0; i < images.length; i++) {
      await downloadImageFile(images[i].url, `${prefix}-${i + 1}.png`);
      if (i < images.length - 1) await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }, [images]);

  const clearImages = useCallback(() => {
    setImages([]);
    setTaskId(null);
    setError(null);
  }, []);

  return {
    images,
    taskId,
    error,
    isSubmitting,
    isPolling,
    isLoading: isSubmitting || isPolling,
    submit,
    poll,
    submitAndPoll,
    downloadImage,
    downloadAllImages,
    clearImages,
  };
}
