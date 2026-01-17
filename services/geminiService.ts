
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MaterialType, SentenceTemplate, WordChunk, ShadowingLine } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Audio Global Manager
let activeAudioSource: AudioBufferSourceNode | null = null;
let audioCtx: AudioContext | null = null;

export const stopGlobalAudio = () => {
  if (activeAudioSource) {
    try { 
      activeAudioSource.stop(); 
      activeAudioSource.onended = null;
    } catch (e) {}
    activeAudioSource = null;
  }
};

const splitTextIntoChunks = (text: string, maxLength: number = 2500): string[] => {
  const chunks: string[] = [];
  let currentPos = 0;
  while (currentPos < text.length) {
    let endPos = currentPos + maxLength;
    if (endPos < text.length) {
      const lastNewline = text.lastIndexOf('\n', endPos);
      const lastPeriod = text.lastIndexOf('.', endPos);
      const breakPoint = Math.max(lastNewline, lastPeriod);
      if (breakPoint > currentPos) endPos = breakPoint + 1;
    }
    chunks.push(text.substring(currentPos, endPos));
    currentPos = endPos;
  }
  return chunks;
};

export const extractMaterialsAuto = async (
  input: string, 
  onProgress?: (current: number, total: number) => void
): Promise<{ templates: Partial<SentenceTemplate>[], chunks: Partial<WordChunk>[] }> => {
  const textChunks = splitTextIntoChunks(input);
  let allTemplates: Partial<SentenceTemplate>[] = [];
  let allChunks: Partial<WordChunk>[] = [];

  for (let i = 0; i < textChunks.length; i++) {
    if (onProgress) onProgress(i + 1, textChunks.length);
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a Korean Applied Linguistics Expert. Extract oral learning materials from the text below.
      
      CRITICAL DEFINITIONS:
      1. SENTENCE TEMPLATES: Grammar patterns, endings. Provide 2 varied examples with precise Chinese translations.
      2. WORD CHUNKS: High-frequency collocations. Provide a root translation and 1-2 variations, each with its own precise Chinese translation.

      TEXT TO ANALYZE:
      "${textChunks[i]}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            templates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pattern: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  examples: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        kr: { type: Type.STRING },
                        cn: { type: Type.STRING }
                      },
                      required: ["kr", "cn"]
                    }
                  }
                },
                required: ["pattern", "topic", "examples"]
              }
            },
            chunks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  root: { type: Type.STRING },
                  translation: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  variations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { 
                        kr: { type: Type.STRING },
                        cn: { type: Type.STRING } 
                      },
                      required: ["kr", "cn"]
                    }
                  }
                },
                required: ["root", "translation", "topic", "variations"]
              }
            }
          }
        }
      }
    });

    try {
      const result = JSON.parse(response.text || '{"templates":[], "chunks":[]}');
      if (result.templates) allTemplates = [...allTemplates, ...result.templates];
      if (result.chunks) allChunks = [...allChunks, ...result.chunks];
    } catch (e) {
      console.error("Failed to parse chunk", i, e);
    }
  }

  const uniqueTemplates = Array.from(new Map(allTemplates.map(t => [t.pattern?.toLowerCase(), t])).values());
  const uniqueChunks = Array.from(new Map(allChunks.map(c => [c.root?.toLowerCase(), c])).values());

  return { templates: uniqueTemplates, chunks: uniqueChunks };
};

export const evaluateAudioResponse = async (base64Audio: string, targetTranslation: string): Promise<{ transcript: string, feedback: string }> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'audio/wav', data: base64Audio } },
        { text: `Transcribe this Korean audio AND evaluate if it matches this specific Chinese meaning: "${targetTranslation}". 
                 The feedback must be constructive.
                 Return JSON: { "transcript": "the transcription", "feedback": "Short feedback in Chinese" }` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 }
    }
  });

  try {
    return JSON.parse(response.text || '{"transcript":"", "feedback":"Error"}');
  } catch (e) {
    return { transcript: "识别失败", feedback: "解析异常" };
  }
};

export const checkAnswerFast = async (userOutput: string, targetTranslation: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Compare user's Korean: "${userOutput}" to target Chinese meaning: "${targetTranslation}". 
               Brief feedback in Chinese (<30 words) explaining any nuances.`,
    config: {
      thinkingConfig: { thinkingBudget: 0 }
    }
  });
  return response.text || "";
};

export const generateShadowingContent = async (templates: SentenceTemplate[], chunks: WordChunk[], topic: string): Promise<ShadowingLine[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Topic: "${topic}". Dialogue with patterns: ${templates.map(t => t.pattern).join(', ')} and chunks: ${chunks.map(c => c.root).join(', ')}. JSON [{korean, chinese}].`,
    config: { responseMimeType: "application/json" }
  });
  try { return JSON.parse(response.text || '[]'); } catch (e) { return []; }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e) { return null; }
};

export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

export const playAudioSafely = async (audioData: string, onEnded?: () => void) => {
  stopGlobalAudio();
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  const bytes = decodeBase64(audioData);
  const buffer = await decodeAudioData(bytes, audioCtx, 24000, 1);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.onended = () => {
    if (onEnded) onEnded();
    if (activeAudioSource === source) activeAudioSource = null;
  };
  activeAudioSource = source;
  source.start();
};
