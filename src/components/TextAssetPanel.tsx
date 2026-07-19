import React, { useRef, useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { FileText, Search, Plus, CheckCircle, XCircle, Download, Sparkles } from 'lucide-react';
import type { LocaleCode } from '../text/types';
import { defaultPreviewLocale } from '../text/localeValidation';
import { createDefaultCueBase, slugifyForKey } from '../text/constants';
import { EXAMPLE_EN_CATALOG } from '../text/exampleContent';
import './components.css';

interface ImportSummary {
  fileName: string;
  locale: string | null;
  accepted: boolean;
  stringCount: number;
  reasons: string[];
}

export const TextAssetPanel: React.FC = () => {
  const {
    text,
    importTextCatalogs,
    importTextTimeline,
    addTextCue,
    injectCatalogEntry,
    setPreviewLocale,
    playhead,
  } = useProject();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importSummaries, setImportSummaries] = useState<ImportSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTextValue, setNewTextValue] = useState('');
  const [newLocaleValue, setNewLocaleValue] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Initialize 'en' locale if catalogs are empty on mount to make manual insertion first-class
  useEffect(() => {
    if (Object.keys(text.catalogs).length === 0) {
      injectCatalogEntry('en' as LocaleCode, '', '');
      setPreviewLocale('en' as LocaleCode);
    }
  }, [text.catalogs, injectCatalogEntry, setPreviewLocale]);

  // Initialize preview locale on first import/injection
  useEffect(() => {
    if (text.previewLocale === null && Object.keys(text.catalogs).length > 0) {
      const locales = Object.keys(text.catalogs);
      const browserLocale = navigator.language;
      const defaultLocale = defaultPreviewLocale(locales, browserLocale);
      if (defaultLocale) {
        setPreviewLocale(defaultLocale);
      }
    }
  }, [text.catalogs, text.previewLocale, setPreviewLocale]);

  const handleAddLocale = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newLocaleValue.trim().toLowerCase();
    if (!val) return;
    try {
      const [canonical] = Intl.getCanonicalLocales(val);
      if (canonical) {
        injectCatalogEntry(canonical as LocaleCode, '', '');
        setPreviewLocale(canonical as LocaleCode);
        setNewLocaleValue('');
      }
    } catch {
      alert(`Invalid BCP 47 locale tag: "${val}"`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Separate timeline.json from catalog files
    const catalogFiles: File[] = [];
    let timelineFile: File | null = null;

    for (const file of Array.from(files)) {
      if (file.name.toLowerCase() === 'timeline.json') {
        timelineFile = file;
      } else {
        catalogFiles.push(file);
      }
    }

    // Import catalogs
    let catalogResult: any = { accepted: {}, summaries: [], duplicateLocales: [] };
    if (catalogFiles.length > 0) {
      catalogResult = await importTextCatalogs(catalogFiles);
      setImportSummaries(
        catalogResult.summaries.map((s: any) => ({
          fileName: s.fileName,
          locale: s.locale,
          accepted: s.accepted,
          stringCount: s.stringCount,
          reasons: s.reasons || [],
        })),
      );
    }

    // Import timeline if present
    if (timelineFile) {
      await importTextTimeline(timelineFile);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Add free-form text directly into a catalog (no JSON files). The key is
  // derived from the text and hidden from the brainstorming UX.
  const handleAddText = (e: React.FormEvent) => {
    e.preventDefault();
    const value = newTextValue.trim();
    if (!value) return;

    const locale = (text.previewLocale || 'en') as LocaleCode;
    const existing = text.catalogs[locale]?.strings ?? {};
    const baseKey = slugifyForKey(value);
    let key = baseKey;
    let suffix = 2;
    while (existing[key] !== undefined) {
      key = `${baseKey}-${suffix++}`;
    }

    injectCatalogEntry(locale, key, value);
    setNewTextValue('');
  };

  // Inject the built-in English example strings in-memory (no files, no picker).
  const handleAddExampleText = () => {
    for (const [key, value] of Object.entries(EXAMPLE_EN_CATALOG)) {
      injectCatalogEntry('en', key, value);
    }
  };

  const handlePlaceAtPlayhead = (key: string) => {
    const catalog = text.catalogs[text.previewLocale || ''];
    if (!catalog) return;

    const cueBase = createDefaultCueBase(key, playhead);
    addTextCue({
      base: cueBase,
      overrides: {},
    });
  };

  // Export the present locale catalogs as canonical <locale>.json files (the
  // translate-then-reimport workflow). Explicit power action — not the default.
  const handleExportCatalogFiles = async () => {
    const locales = Object.keys(text.catalogs);
    if (locales.length === 0) return;
    setIsExporting(true);
    try {
      if (!('showDirectoryPicker' in window)) {
        // Non-Chromium fallback: download each locale file.
        for (const locale of locales) {
          downloadJson(`${locale}.json`, text.catalogs[locale].strings);
        }
        return;
      }

      const dirHandle = await (window as any).showDirectoryPicker();
      for (const locale of locales) {
        const fileHandle = await dirHandle.getFileHandle(`${locale}.json`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(text.catalogs[locale].strings, null, 2));
        await writable.close();
      }
    } catch (error) {
      // User cancelled the picker — bail quietly, no download barrage.
      if ((error as any)?.name === 'AbortError') return;
      console.error('Failed to export catalog files:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Sort locales by name
  const sortedLocales = Object.keys(text.catalogs).sort();

  // The list enumerates entries from the active (preview) locale so every shown
  // item has a value to render. Keys stay hidden; the user sees display text.
  const activeLocale: LocaleCode | null =
    text.previewLocale ??
    (sortedLocales.includes('en') ? 'en' : ((sortedLocales[0] as LocaleCode | undefined) ?? null));
  const activeCatalog = activeLocale ? text.catalogs[activeLocale] : undefined;
  const entries = activeCatalog ? Object.entries(activeCatalog.strings) : [];
  const filteredEntries = searchQuery
    ? entries.filter(([, value]) => value.toLowerCase().includes(searchQuery.toLowerCase()))
    : entries;

  return (
    <div className='text-asset-panel'>
      {/* Add Text (primary, no files) */}
      <div className='panel-section'>
        <div className='panel-header'>
          <div className='panel-title'>
            <FileText size={18} />
            <span>Add Text</span>
          </div>
        </div>

        <p
          className='asset-panel-hint'
          style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            marginBottom: '14px',
            lineHeight: '1.4',
            background: 'rgba(255,255,255,0.03)',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          💡 Type text to add it to your project, then place it on the timeline to show it in the
          video.
        </p>

        <form
          onSubmit={handleAddText}
          style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}
        >
          <input
            type='text'
            placeholder='Type text and press Enter…'
            value={newTextValue}
            onChange={(e) => setNewTextValue(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <button
            type='submit'
            className='btn btn-primary btn-sm'
            style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
        </form>

        <button
          className='btn btn-secondary btn-sm'
          onClick={handleAddExampleText}
          style={{ width: '100%' }}
        >
          <Sparkles size={14} />
          <span>Add example text</span>
        </button>
      </div>

      {/* Locale Status List */}
      {sortedLocales.length > 0 && (
        <div className='panel-section' style={{ marginTop: '20px' }}>
          <div
            className='panel-title'
            style={{
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '12px',
              color: 'var(--color-text-primary)',
            }}
          >
            Locales
          </div>
          <div className='locale-list'>
            {sortedLocales.map((locale) => {
              const catalog = text.catalogs[locale];
              const isPreview =
                text.previewLocale === locale ||
                (text.previewLocale === null && locale === activeLocale);
              const keyCount = Object.keys(catalog.strings).length;
              return (
                <div
                  key={locale}
                  className='locale-item'
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    marginBottom: '6px',
                    background: isPreview ? 'rgba(37, 99, 235, 0.1)' : 'rgba(255,255,255,0.02)',
                    border: isPreview
                      ? '1px solid var(--color-primary)'
                      : '1px solid var(--color-border-subtle)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setPreviewLocale(locale)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {locale}
                    </span>
                    {isPreview && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--color-primary)',
                          background: 'rgba(37, 99, 235, 0.15)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        Preview
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {keyCount} keys
                  </span>
                </div>
              );
            })}
          </div>
          {/* Form to add a new BCP 47 locale manually */}
          <form
            onSubmit={handleAddLocale}
            style={{ display: 'flex', gap: '8px', marginTop: '12px' }}
          >
            <input
              type='text'
              placeholder='Add locale (e.g. sv, es, fr)…'
              value={newLocaleValue}
              onChange={(e) => setNewLocaleValue(e.target.value)}
              style={{
                flex: 1,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                padding: '6px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'var(--font-sans)',
              }}
            />
            <button
              type='submit'
              className='btn btn-secondary btn-sm'
              style={{ padding: '6px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
            >
              <Plus size={12} />
              <span>Add Locale</span>
            </button>
          </form>
        </div>
      )}

      {/* Text list (active locale, value-based, keys hidden) */}
      {activeLocale && (
        <div className='panel-section' style={{ marginTop: '20px' }}>
          <div
            className='panel-title'
            style={{
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '12px',
              color: 'var(--color-text-primary)',
            }}
          >
            Text ({activeLocale})
          </div>
          <div
            className='search-input-wrapper'
            style={{ position: 'relative', marginBottom: '12px' }}
          >
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
              }}
            />
            <input
              type='text'
              placeholder='Search text…'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                padding: '8px 10px 8px 32px',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          <div className='key-list' style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filteredEntries.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: 'var(--color-text-muted)',
                  fontSize: '12px',
                }}
              >
                {searchQuery ? 'No matching text' : 'No text yet — type above to add some'}
              </div>
            ) : (
              filteredEntries.map(([key, value]) => {
                const previewValue = value.substring(0, 60) + (value.length > 60 ? '…' : '');
                return (
                  <div
                    key={key}
                    className='key-item'
                    style={{
                      padding: '10px 12px',
                      marginBottom: '6px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            color: 'var(--color-text-primary)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'normal',
                            overflowWrap: 'break-word',
                          }}
                        >
                          {previewValue}
                        </div>
                      </div>
                      <button
                        className='btn btn-primary btn-sm'
                        onClick={() => handlePlaceAtPlayhead(key)}
                        style={{ padding: '6px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
                        title='Place at playhead'
                      >
                        <Plus size={12} />
                        <span>Place</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Import / Export files (secondary) */}
      <div className='panel-section' style={{ marginTop: '20px' }}>
        <div className='panel-header'>
          <div className='panel-title'>
            <FileText size={18} />
            <span>Import / Export files</span>
          </div>
          <button
            className='btn btn-secondary btn-sm'
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus size={16} />
            <span>Add JSON</span>
          </button>
          <input
            type='file'
            ref={fileInputRef}
            onChange={handleFileChange}
            accept='.json'
            multiple
            style={{ display: 'none' }}
          />
        </div>

        <p
          className='asset-panel-hint'
          style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            marginBottom: '14px',
            lineHeight: '1.4',
          }}
        >
          Optional: import locale catalogs (en.json, sv.json) + timeline.json, or export your
          catalogs to translate them offline.
        </p>

        {/* Import Summary Table */}
        {importSummaries.length > 0 && (
          <div className='import-summary-table' style={{ marginBottom: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th
                    style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)' }}
                  >
                    File
                  </th>
                  <th
                    style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)' }}
                  >
                    Locale
                  </th>
                  <th
                    style={{
                      textAlign: 'center',
                      padding: '8px',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      textAlign: 'center',
                      padding: '8px',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Strings
                  </th>
                </tr>
              </thead>
              <tbody>
                {importSummaries.map((summary, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '8px', color: 'var(--color-text-primary)' }}>
                      {summary.fileName}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>
                      {summary.locale || '-'}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {summary.accepted ? (
                        <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
                      ) : (
                        <XCircle size={14} style={{ color: 'var(--color-danger)' }} />
                      )}
                    </td>
                    <td
                      style={{
                        padding: '8px',
                        textAlign: 'center',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {summary.stringCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          className='btn btn-secondary btn-sm'
          onClick={handleExportCatalogFiles}
          disabled={isExporting || sortedLocales.length === 0}
          style={{ width: '100%' }}
        >
          <Download size={14} />
          <span>{isExporting ? 'Exporting…' : 'Export catalog files…'}</span>
        </button>
      </div>
    </div>
  );
};

/** Trigger a browser download of a JSON file (fallback when no directory picker). */
const downloadJson = (fileName: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};
