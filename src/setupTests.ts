import '@testing-library/jest-dom';

// Polyfill crypto.getRandomValues for jsdom environment
if (!globalThis.crypto?.getRandomValues) {
  globalThis.crypto = {
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
  } as Crypto;
}

// Polyfill File.text() method for jsdom
if (File.prototype.text === undefined) {
  File.prototype.text = async function (this: File) {
    const text = await this.arrayBuffer();
    const decoder = new TextDecoder();
    return decoder.decode(text);
  };
}

// Mock localStorage for jsdom environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock URL.createObjectURL and URL.revokeObjectURL
Object.defineProperty(window.URL, 'createObjectURL', {
  value: () => 'mock-blob-url',
  writable: true,
});

Object.defineProperty(window.URL, 'revokeObjectURL', {
  value: () => {},
  writable: true,
});
