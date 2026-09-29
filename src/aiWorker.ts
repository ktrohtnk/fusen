import { pipeline, env } from '@xenova/transformers';

// Web Worker settings
env.allowLocalModels = false;

let extractor: any = null;

async function initExtractor() {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      progress_callback: (x: any) => {
        self.postMessage({ status: 'progress', data: x });
      }
    });
  }
  return extractor;
}

self.addEventListener('message', async (event) => {
  if (event.data.type === 'init') {
    self.postMessage({ status: 'init_start' });
    await initExtractor();
    self.postMessage({ status: 'ready' });
    return;
  }

  const { id, text } = event.data;
  if (!text) return;

  try {
    const extract = await initExtractor();
    const output = await extract(text, { pooling: 'mean', normalize: true });
    
    // Convert Float32Array to standard Array
    const embedding = Array.from(output.data);
    
    self.postMessage({
      status: 'complete',
      id,
      embedding
    });
  } catch (error) {
    self.postMessage({
      status: 'error',
      id,
      error: String(error)
    });
  }
});
