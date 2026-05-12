import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
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

const ERROR_CODES = [
  "authentication_error", "rate_limit_error", "invalid_request_error",
  "overloaded_error", "insufficient_credits", "permission_error",
  "api_error", "not_found_error", "internal_error", "configuration_error",
] as const;
type ErrorCode = (typeof ERROR_CODES)[number];

function isKnownCode(code: string): code is ErrorCode {
  return ERROR_CODES.includes(code as ErrorCode);
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
  const { t } = useTranslation();
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const getUserMessage = useCallback((code?: string, backendMessage?: string): string => {
    if (backendMessage) return backendMessage;
    if (code && isKnownCode(code)) return t(`imageGen.errors.${code}`);
    return t("imageGen.errors.api_error");
  }, [t]);
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
      throw new Error(t("imageGen.errors.network_error"));
    }
    if (invokeError instanceof FunctionsFetchError) {
      throw new Error(t("imageGen.errors.fetch_error"));
    }
    if (invokeError instanceof Error) throw invokeError;
    throw new Error(t("imageGen.errors.fetch_error"));
  }, [getUserMessage, t]);

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
        throw new Error(getUserMessage(data?.code, data?.message || t("imageGen.errors.api_error")));
      }

      setTaskId(data.task_id);
      return data.task_id;
    } catch (err) {
      const message = err instanceof Error ? err.message : t("imageGen.errors.api_error");
      setError(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [handleInvokeError, getUserMessage, t, supabase]);

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
        if (!data) throw new Error(t("imageGen.errors.poll_error"));
        if (data.status === "failed") throw new Error(data.error || t("imageGen.errors.api_error"));
        if (data.status === "succeed") {
          const nextImages = data.images || [];
          setImages(nextImages);
          return nextImages;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      throw new Error(t("imageGen.errors.timeout_error"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("imageGen.errors.poll_error");
      setError(message);
      return null;
    } finally {
      setIsPolling(false);
    }
  }, [handleInvokeError, t, supabase]);

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
