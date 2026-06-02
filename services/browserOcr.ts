const TESSERACT_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

type TesseractApi = {
  recognize: (image: File | Blob | string, language: string, options?: { logger?: (message: { progress?: number; status?: string }) => void }) => Promise<{ data: { text: string } }>;
};

declare global {
  interface Window { Tesseract?: TesseractApi; }
}

const loadTesseract = (): Promise<TesseractApi> => new Promise((resolve, reject) => {
  if (typeof window === 'undefined') {
    reject(new Error('OCR доступен только в браузере.'));
    return;
  }
  if (window.Tesseract) {
    resolve(window.Tesseract);
    return;
  }
  const existing = document.querySelector<HTMLScriptElement>('script[data-annword-ocr]');
  const script = existing || document.createElement('script');
  if (!existing) {
    script.src = TESSERACT_SCRIPT_URL;
    script.async = true;
    script.dataset.annwordOcr = 'true';
    document.head.appendChild(script);
  }
  script.addEventListener('load', () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR-движок не загрузился.')),
    { once: true });
  script.addEventListener('error', () => reject(new Error('Не удалось загрузить бесплатный OCR-движок.')), { once: true });
});

const extractEnglishWords = (text: string): string[] => Array.from(new Set(
  (text.match(/[A-Za-z][A-Za-z'-]{1,}/g) || [])
    .map(word => word.replace(/[^A-Za-z'-]/g, '').toUpperCase())
    .filter(word => word.length >= 2),
));

export const browserOcrService = {
  async recognizeWords(file: File, onProgress?: (percent: number, label: string) => void): Promise<string[]> {
    const tesseract = await loadTesseract();
    const result = await tesseract.recognize(file, 'eng', {
      logger: message => {
        if (typeof message.progress === 'number') {
          onProgress?.(Math.round(message.progress * 100), message.status || 'Распознавание');
        }
      },
    });
    return extractEnglishWords(result.data.text);
  },
  extractEnglishWords,
};
