import React, { useRef, useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { FileText, Search, Plus, CheckCircle, XCircle, FolderOpen } from 'lucide-react';
import { defaultPreviewLocale } from '../text/localeValidation';
import { createDefaultCueBase } from '../text/constants';
import './components.css';

interface ImportSummary {
  fileName: string;
  locale: string | null;
  accepted: boolean;
  stringCount: number;
  reasons: string[];
}

export const TextAssetPanel: React.FC = () => {
  const { text, importTextCatalogs, importTextTimeline, addTextCue, setPreviewLocale, playhead } = useProject();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importSummaries, setImportSummaries] = useState<ImportSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize preview locale on first import
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
      setImportSummaries(catalogResult.summaries.map((s: any) => ({
        fileName: s.fileName,
        locale: s.locale,
        accepted: s.accepted,
        stringCount: s.stringCount,
        reasons: s.reasons || []
      })));
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

  const handleGenerateExample = async () => {
    setIsGenerating(true);
    try {
      // Check if showDirectoryPicker is available (Chromium only)
      if (!('showDirectoryPicker' in window)) {
        // Fallback: download individual files
        await downloadExamplePackage();
        return;
      }

      // Request directory handle from user
      const dirHandle = await (window as any).showDirectoryPicker();

      // Example content for each locale
      const exampleContent: Record<string, any> = {
        'en.json': {
          'welcome_title': 'Create something\namazing',
          'feature_export': 'Export locally',
          'subtitle_tagline': 'Your stories, everywhere',
        },
        'sv.json': {
          'welcome_title': 'Skapa något\n fantastiskt',
          'feature_export': 'Exportera lokalt',
          'subtitle_tagline': 'Dina berättelser, överallt',
        },
        'it.json': {
          'welcome_title': 'Crea qualcosa\n di incredibile',
          'feature_export': 'Esporta localmente',
          'subtitle_tagline': 'Le tue storie, ovunque',
        },
        'tr.json': {
          'welcome_title': 'Şaşırtıcı bir şey\n yaratabilirsiniz',
          'feature_export': 'Yerel olarak dışa aktar',
          'subtitle_tagline': 'Hikayeleriniz, her yerde',
        },
        'pt-BR.json': {
          'welcome_title': 'Crie algo\n incrível',
          'feature_export': 'Exportar localmente',
          'subtitle_tagline': 'Suas histórias, em todo lugar',
        },
        'de.json': {
          'welcome_title': 'Erstelle etwas\nErstaunliches',
          'feature_export': 'Lokal exportieren',
          'subtitle_tagline': 'Deine Geschichten, überall',
        },
        'fr.json': {
          'welcome_title': 'Créez quelque chose\n d\'incroyable',
          'feature_export': 'Exporter localement',
          'subtitle_tagline': 'Vos histoires, partout',
        },
        'ja.json': {
          'welcome_title': '素晴らしいものを\n作成しましょう',
          'feature_export': 'ローカルでエクスポート',
          'subtitle_tagline': 'あなたの物語を、あらゆる場所へ',
        },
        'es.json': {
          'welcome_title': 'Crea algo\n increíble',
          'feature_export': 'Exportar localmente',
          'subtitle_tagline': 'Tus historias, en todas partes',
        },
      };

      const timelineContent = {
        version: 1,
        cues: [
          {
            id: 'intro',
            stringKey: 'welcome_title',
            startTime: 1.5,
            duration: 3,
            horizontalAlign: 'center',
            verticalAlign: 'bottom',
            color: '#FFFFFF',
            fontSize: 72
          },
          {
            id: 'feature',
            stringKey: 'feature_export',
            startTime: 5,
            duration: 2.5,
            horizontalAlign: 'center',
            verticalAlign: 'middle',
            color: '#FFFFFF',
            fontSize: 60
          },
          {
            id: 'tagline',
            stringKey: 'subtitle_tagline',
            startTime: 8,
            duration: 4,
            horizontalAlign: 'center',
            verticalAlign: 'top',
            color: '#CCCCCC',
            fontSize: 48
          }
        ]
      };

      // Write catalog files
      for (const [fileName, content] of Object.entries(exampleContent)) {
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(content, null, 2));
        await writable.close();
      }

      // Write timeline file
      const timelineHandle = await dirHandle.getFileHandle('timeline.json', { create: true });
      const timelineWritable = await timelineHandle.createWritable();
      await timelineWritable.write(JSON.stringify(timelineContent, null, 2));
      await timelineWritable.close();

    } catch (error) {
      console.error('Failed to generate example package:', error);
      // If directory picker failed, fall back to download
      await downloadExamplePackage();
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadExamplePackage = async () => {
    // Create a simple HTML page with download links
    const exampleContent: Record<string, any> = {
      'en.json': {
        'welcome_title': 'Create something\namazing',
        'feature_export': 'Export locally',
        'subtitle_tagline': 'Your stories, everywhere',
      },
      'sv.json': {
        'welcome_title': 'Skapa något\nfantastiskt',
        'feature_export': 'Exportera lokalt',
        'subtitle_tagline': 'Dina berättelser, överallt',
      },
      'it.json': {
        'welcome_title': 'Crea qualcosa\ndi incredibile',
        'feature_export': 'Esporta localmente',
        'subtitle_tagline': 'Le tue storie, ovunque',
      },
      'tr.json': {
        'welcome_title': 'Şaşırtıcı bir şey\nyaratabilirsiniz',
        'feature_export': 'Yerel olarak dışa aktar',
        'subtitle_tagline': 'Hikayeleriniz, her yerde',
      },
      'pt-BR.json': {
        'welcome_title': 'Crie algo\nincrível',
        'feature_export': 'Exportar localmente',
        'subtitle_tagline': 'Suas histórias, em todo lugar',
      },
      'de.json': {
        'welcome_title': 'Erstelle etwas\nErstaunliches',
        'feature_export': 'Lokal exportieren',
        'subtitle_tagline': 'Deine Geschichten, überall',
      },
      'fr.json': {
        'welcome_title': 'Créez quelque chose\nd\'incroyable',
        'feature_export': 'Exporter localement',
        'subtitle_tagline': 'Vos histoires, partout',
      },
      'ja.json': {
        'welcome_title': '素晴らしいものを\n作成しましょう',
        'feature_export': 'ローカルでエクスポート',
        'subtitle_tagline': 'あなたの物語を、あらゆる場所へ',
      },
      'es.json': {
        'welcome_title': 'Crea algo\nincreíble',
        'feature_export': 'Exportar localmente',
        'subtitle_tagline': 'Tus historias, en todas partes',
      },
    };

    const timelineContent = {
      version: 1,
      cues: [
        {
          id: 'intro',
          stringKey: 'welcome_title',
          startTime: 1.5,
          duration: 3,
          horizontalAlign: 'center',
          verticalAlign: 'bottom',
          color: '#FFFFFF',
          fontSize: 72
        },
        {
          id: 'feature',
          stringKey: 'feature_export',
          startTime: 5,
          duration: 2.5,
          horizontalAlign: 'center',
          verticalAlign: 'middle',
          color: '#FFFFFF',
          fontSize: 60
        },
        {
          id: 'tagline',
          stringKey: 'subtitle_tagline',
          startTime: 8,
          duration: 4,
          horizontalAlign: 'center',
          verticalAlign: 'top',
          color: '#CCCCCC',
          fontSize: 48
        }
      ]
    };

    // Download each file
    for (const [fileName, content] of Object.entries(exampleContent)) {
      const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }

    // Download timeline.json
    const timelineBlob = new Blob([JSON.stringify(timelineContent, null, 2)], { type: 'application/json' });
    const timelineUrl = URL.createObjectURL(timelineBlob);
    const timelineA = document.createElement('a');
    timelineA.href = timelineUrl;
    timelineA.download = 'timeline.json';
    timelineA.click();
    URL.revokeObjectURL(timelineUrl);
  };

  const handlePlaceAtPlayhead = (key: string) => {
    const catalog = text.catalogs[text.previewLocale || ''];
    if (!catalog) return;

    const cueBase = createDefaultCueBase(key, playhead);
    addTextCue({
      base: cueBase,
      overrides: {}
    });
  };

  // Get all unique keys from all catalogs
  const getAllKeys = () => {
    const keys = new Set<string>();
    Object.values(text.catalogs).forEach(catalog => {
      Object.keys(catalog.strings).forEach(key => keys.add(key));
    });
    return Array.from(keys);
  };

  // Filter keys based on search query
  const filteredKeys = searchQuery
    ? getAllKeys().filter(key => key.toLowerCase().includes(searchQuery.toLowerCase()))
    : getAllKeys();

  // Sort locales by name
  const sortedLocales = Object.keys(text.catalogs).sort();

  return (
    <div className="text-asset-panel">
      {/* Import Section */}
      <div className="panel-section">
        <div className="panel-header">
          <div className="panel-title">
            <FileText size={18} />
            <span>Import Text</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
            <Plus size={16} />
            <span>Add Files</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            multiple
            style={{ display: 'none' }}
          />
        </div>

        <p className="asset-panel-hint" style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '14px', lineHeight: '1.4', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          💡 Import locale catalogs (e.g., en.json, sv.json) and optionally timeline.json to place text overlays on your video.
        </p>

        {/* Import Summary Table */}
        {importSummaries.length > 0 && (
          <div className="import-summary-table">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)' }}>File</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)' }}>Locale</th>
                  <th style={{ textAlign: 'center', padding: '8px', color: 'var(--color-text-muted)' }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '8px', color: 'var(--color-text-muted)' }}>Strings</th>
                </tr>
              </thead>
              <tbody>
                {importSummaries.map((summary, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '8px', color: 'var(--color-text-primary)' }}>{summary.fileName}</td>
                    <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{summary.locale || '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {summary.accepted ? (
                        <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
                      ) : (
                        <XCircle size={14} style={{ color: 'var(--color-danger)' }} />
                      )}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{summary.stringCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Generate Example Button */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleGenerateExample}
          disabled={isGenerating}
          style={{ width: '100%', marginTop: '12px' }}
        >
          <FolderOpen size={16} />
          <span>{isGenerating ? 'Generating...' : 'Generate Example JSON Package'}</span>
        </button>
      </div>

      {/* Locale Status List */}
      {sortedLocales.length > 0 && (
        <div className="panel-section" style={{ marginTop: '20px' }}>
          <div className="panel-title" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--color-text-primary)' }}>
            Imported Locales
          </div>
          <div className="locale-list">
            {sortedLocales.map(locale => {
              const catalog = text.catalogs[locale];
              const isPreview = text.previewLocale === locale;
              const keyCount = Object.keys(catalog.strings).length;
              return (
                <div key={locale} className="locale-item" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  marginBottom: '6px',
                  background: isPreview ? 'rgba(37, 99, 235, 0.1)' : 'rgba(255,255,255,0.02)',
                  border: isPreview ? '1px solid var(--color-primary)' : '1px solid var(--color-border-subtle)',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }} onClick={() => setPreviewLocale(locale)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{locale}</span>
                    {isPreview && <span style={{ fontSize: '10px', color: 'var(--color-primary)', background: 'rgba(37, 99, 235, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>Preview</span>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{keyCount} keys</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Search */}
      {sortedLocales.length > 0 && (
        <div className="panel-section" style={{ marginTop: '20px' }}>
          <div className="panel-title" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--color-text-primary)' }}>
            Translation Keys
          </div>
          <div className="search-input-wrapper" style={{ position: 'relative', marginBottom: '12px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search keys..."
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
                fontFamily: 'var(--font-sans)'
              }}
            />
          </div>

          <div className="key-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filteredKeys.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                {searchQuery ? 'No matching keys found' : 'No keys available'}
              </div>
            ) : (
              filteredKeys.map(key => {
                const catalog = text.catalogs[text.previewLocale || sortedLocales[0]];
                const value = catalog?.strings[key] || '';
                const previewValue = value.substring(0, 40) + (value.length > 40 ? '...' : '');
                return (
                  <div key={key} className="key-item" style={{
                    padding: '10px 12px',
                    marginBottom: '6px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '4px' }}>{key}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{previewValue}</div>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handlePlaceAtPlayhead(key)}
                        style={{ padding: '6px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
                        title="Place at playhead"
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
    </div>
  );
};
