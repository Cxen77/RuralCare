/**
 * RuralCare AI - Model Manager
 * Handles downloading, instantiating, and managing the state of the local LLM using llama.rn.
 *
 * Supports SmolLM2-360M-Instruct Q8_0 (~368 MB) as the single on-device model.
 * Chosen for rural Android devices: < 500 MB footprint, fast inference, short replies.
 */

import type { LlamaContext, RNLlamaOAICompatibleMessage, NativeCompletionResult } from 'llama.rn';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

export type ModelStatus = 
  | 'MODEL_NOT_INSTALLED' 
  | 'MODEL_UNAVAILABLE' 
  | 'MODEL_LOADING' 
  | 'MODEL_READY' 
  | 'INFERENCE_RUNNING' 
  | 'INFERENCE_FAILED' 
  | 'MODEL_ERROR';

// Candidate models: SmolLM2-360M-Instruct (primary) and SmolLM2-1.7B-Instruct
const MODEL_CANDIDATES = [
  {
    name: 'SmolLM2-360M-Instruct',
    filenames: [
      'smollm2-360m-instruct-q8_0.gguf',
    ],
    n_ctx: 1024,
  },
  {
    name: 'SmolLM2-1.7B-Instruct',
    filenames: [
      'smollm2-1.7b-instruct-q4_k_m.gguf',
    ],
    n_ctx: 1024,
  },
];

// Android storage directories to search
const ANDROID_SEARCH_DIRS = [
  '/data/user/0/com.anonymous.ruralcarepatient/files/',
  '/sdcard/Download/',
];

export class ModelManager {
  private static instance: ModelManager;
  private status: ModelStatus = 'MODEL_NOT_INSTALLED';
  private llamaContext: LlamaContext | null = null;
  private loadPromise: Promise<void> | null = null;
  private activeModelName: string = '';
  private listeners: Set<(status: ModelStatus, modelName: string) => void> = new Set();

  private constructor() {}

  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  public getStatus(): ModelStatus {
    return this.status;
  }

  public getActiveModelName(): string {
    return this.activeModelName;
  }

  public addListener(listener: (status: ModelStatus, modelName: string) => void): () => void {
    this.listeners.add(listener);
    listener(this.status, this.activeModelName);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.status, this.activeModelName);
      } catch (e) {
        console.error('[ModelManager] Error in listener:', e);
      }
    }
  }

  public async loadModel(forceReload = false): Promise<void> {
    // If already loaded with the top priority model and not forced, return
    if (!forceReload && this.status === 'MODEL_READY' && this.activeModelName === MODEL_CANDIDATES[0].name) {
      return;
    }
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this._doLoadModel(forceReload);
    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  private async _doLoadModel(forceReload = false): Promise<void> {
    // If forcing reload and a context exists, release it first
    if (this.llamaContext) {
      try {
        console.log('[ModelManager] Releasing existing llama context...');
        await this.llamaContext.release();
      } catch (e) {
        console.warn('[ModelManager] Error releasing previous context:', e);
      }
      this.llamaContext = null;
      this.activeModelName = '';
    }

    this.status = 'MODEL_LOADING';
    this.notifyListeners();
    console.log('[ModelManager] Loading local AI model...');

    try {
      if (Platform.OS === 'web') {
        this.status = 'MODEL_UNAVAILABLE';
        this.notifyListeners();
        console.warn('[ModelManager] Web environment detected. Native llama.rn runtime is only available on Android/iOS.');
        throw new Error('Web not supported for native llama inference');
      }

      const { initLlama, toggleNativeLog, addNativeLogListener } = require('llama.rn');

      try {
        await toggleNativeLog(true);
        addNativeLogListener((level: string, text: string) => {
          console.log(`[llama.cpp][${level}] ${text}`);
        });
      } catch (logErr) {
        console.warn('[ModelManager] Could not enable native logging:', logErr);
      }

      let loadedContext: LlamaContext | null = null;
      let loadedModelName = '';
      let loadedCtxSize = 1024;

      // Try each model candidate in priority order
      for (const model of MODEL_CANDIDATES) {
        if (loadedContext) break;

        for (const filename of model.filenames) {
          if (loadedContext) break;

          // Try each Android directory
          for (const dir of ANDROID_SEARCH_DIRS) {
            const candidatePath = `${dir}${filename}`;
            try {
              console.log(`[ModelManager] Trying ${model.name} at: ${candidatePath}`);
              
              try {
                const { loadLlamaModelInfo } = require('llama.rn');
                const info = await loadLlamaModelInfo(candidatePath);
                console.log(`[ModelManager] Model info for ${model.name}:`, JSON.stringify(info));
              } catch (infoErr) {
                console.warn(`[ModelManager] loadLlamaModelInfo error for ${candidatePath}:`, infoErr);
              }

              loadedContext = await initLlama({
                model: candidatePath,
                n_ctx: 512,
                n_batch: 512,
                n_ubatch: 512,
                n_threads: 4,
                n_gpu_layers: 0,
                use_mmap: false,
                use_mlock: false,
              });
              if (loadedContext) {
                loadedModelName = model.name;
                loadedCtxSize = model.n_ctx;
                console.log(`[ModelManager] ✅ Successfully loaded ${model.name} from: ${candidatePath}`);
                break;
              }
            } catch (candidateErr) {
              console.log(`[ModelManager] ${candidatePath} init failed:`, candidateErr instanceof Error ? candidateErr.message : String(candidateErr));
            }
          }
        }
      }

      // If no local file found, try expo-asset bundle for SmolLM2 (legacy bundled model)
      if (!loadedContext) {
        console.log('[ModelManager] No local model file found. Trying expo-asset bundle...');
        try {
          const modelAsset = require('../../assets/smollm2-360m-instruct-q8_0.gguf');
          const asset = await Asset.fromModule(modelAsset).downloadAsync();
          const targetUri = asset.localUri || asset.uri;
          if (targetUri) {
            const assetPath = targetUri.replace(/^file:\/\//, '');
            console.log(`[ModelManager] Initializing from bundled asset: ${assetPath}`);
            loadedContext = await initLlama({
              model: assetPath,
              use_mlock: false,
              n_ctx: 1024,
            });
            if (loadedContext) {
              loadedModelName = 'SmolLM2-360M-Instruct (bundled)';
              loadedCtxSize = 1024;
            }
          }
        } catch (assetErr) {
          console.log('[ModelManager] Bundled asset fallback failed:', assetErr instanceof Error ? assetErr.message : String(assetErr));
        }
      }

      if (!loadedContext) {
        throw new Error('Failed to initialize Llama context from any path');
      }

      this.llamaContext = loadedContext;
      this.activeModelName = loadedModelName;
      this.status = 'MODEL_READY';
      this.notifyListeners();
      console.log(`[ModelManager] ✅ Local LLM ready! Model=${loadedModelName}, n_ctx=${loadedCtxSize}`);
    } catch (e) {
      if (this.status !== 'MODEL_UNAVAILABLE') {
        this.status = 'MODEL_ERROR';
      }
      this.notifyListeners();
      console.error('[ModelManager] ❌ Could not initialize local LLM runtime:', e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  /**
   * Run chat completion using llama.rn's messages API.
   * Clears KV cache before each inference to prevent cache contamination.
   */
  public async generateChatCompletion(
    messages: RNLlamaOAICompatibleMessage[],
    options: { temperature?: number; n_predict?: number; stop?: string[] } = {}
  ): Promise<string> {
    if (this.status !== 'MODEL_READY' && this.status !== 'INFERENCE_RUNNING') {
      await this.loadModel();
    }
    if (!this.llamaContext) {
      throw new Error('Llama context is null');
    }

    this.status = 'INFERENCE_RUNNING';
    const startTime = Date.now();
    const msgCount = messages.length;
    console.log(`[ModelManager] Inference starting with ${msgCount} messages (model=${this.activeModelName})...`);

    try {
      // Clear the KV cache before every new inference.
      await this.llamaContext.clearCache(false);

      const response: NativeCompletionResult = await this.llamaContext.completion({
        messages,
        temperature: options.temperature ?? 0.7,
        top_p: 0.9,
        top_k: 40,
        penalty_repeat: 1.3,
        penalty_last_n: 64,
        n_predict: options.n_predict ?? 96, // short, fast responses
        stop: options.stop ?? ['<|im_end|>', '<|endoftext|>', '<|im_start|>', '\n\n\n'],
        enable_thinking: false,
        jinja: false,
      });

      const durationMs = Date.now() - startTime;
      const tokensGenerated = response.tokens_predicted ?? 0;
      console.log(`[ModelManager] ✅ Inference finished in ${durationMs}ms (${tokensGenerated} tokens)`);
      this.status = 'MODEL_READY';

      let text = (response.text || '').trim();
      // Clean up surrounding quotes if the model wrapped the entire response in quotes
      if (text.startsWith('"') && text.endsWith('"') && text.length > 2) {
        text = text.slice(1, -1).trim();
      }
      return text;
    } catch (e) {
      this.status = 'INFERENCE_FAILED';
      console.error('[ModelManager] Local inference failed:', e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  /**
   * Legacy raw-prompt completion API.
   */
  public async generateCompletion(prompt: string, options: any = {}): Promise<string> {
    if (this.status !== 'MODEL_READY' && this.status !== 'INFERENCE_RUNNING') {
      await this.loadModel();
    }
    if (!this.llamaContext) {
      throw new Error('Llama context is null');
    }

    this.status = 'INFERENCE_RUNNING';
    console.log(`[ModelManager] Running raw inference (prompt length: ${prompt.length})`);
    const startTime = Date.now();

    try {
      await this.llamaContext.clearCache(false);

      const response = await this.llamaContext.completion({
        prompt,
        temperature: options.temperature ?? 0.7,
        top_p: 0.9,
        n_predict: options.n_predict ?? 96,
        stop: ['<|im_end|>', '<|endoftext|>', 'User:', 'Patient:'],
      });

      const durationMs = Date.now() - startTime;
      console.log(`[ModelManager] Raw inference finished in ${durationMs}ms`);
      this.status = 'MODEL_READY';

      return (response.text || '').trim();
    } catch (e) {
      this.status = 'INFERENCE_FAILED';
      console.error('[ModelManager] Raw inference failed:', e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  public async unloadModel(): Promise<void> {
    if (this.llamaContext) {
      await this.llamaContext.release();
      this.llamaContext = null;
    }
    this.status = 'MODEL_NOT_INSTALLED';
    this.activeModelName = '';
    this.notifyListeners();
  }
}
