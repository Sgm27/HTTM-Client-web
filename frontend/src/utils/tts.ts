const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export interface SynthesizeSpeechOptions {
  signal?: AbortSignal;
}

export interface SynthesizeSpeechResult {
  blob: Blob;
  duration: number | null;
}

const normalizeBackendUrl = (url: string) => url.replace(/\/$/, "");

export async function synthesizeSpeech(
  text: string,
  options: SynthesizeSpeechOptions = {}
): Promise<SynthesizeSpeechResult> {
  if (!text.trim()) {
    throw new Error("Text is required for synthesis");
  }

  if (!BACKEND_URL || BACKEND_URL === "mock") {
    throw new Error("Backend URL is not configured for TTS");
  }

  const endpoint = `${normalizeBackendUrl(BACKEND_URL)}/api/ml/tts`;
  const formData = new FormData();
  formData.set("text", text);

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const message = errorText || `TTS request failed with status ${response.status}`;
    throw new Error(message);
  }

  const blob = await response.blob();
  const durationHeader = response.headers.get("X-Audio-Duration");
  const duration = durationHeader ? Number.parseFloat(durationHeader) : NaN;

  return {
    blob,
    duration: Number.isFinite(duration) ? duration : null,
  };
}
