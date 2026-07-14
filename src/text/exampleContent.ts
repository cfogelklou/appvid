/**
 * Shared example content for the text feature. Single source of truth used by
 * "Add example text" (in-memory injection of the English catalog) and by the
 * explicit "Export catalog files…" power action.
 */
import { TIMELINE_VERSION } from './constants';

/** English example strings — what "Add example text" injects in-memory. */
export const EXAMPLE_EN_CATALOG: Record<string, string> = {
  welcome_title: 'Create something\namazing',
  feature_export: 'Export locally',
  subtitle_tagline: 'Your stories, everywhere',
};

/** Full multi-locale example set, one entry per built-in locale. */
export const EXAMPLE_CATALOGS: Record<string, Record<string, string>> = {
  en: EXAMPLE_EN_CATALOG,
  sv: {
    welcome_title: 'Skapa något\nfantastiskt',
    feature_export: 'Exportera lokalt',
    subtitle_tagline: 'Dina berättelser, överallt',
  },
  it: {
    welcome_title: 'Crea qualcosa\ndi incredibile',
    feature_export: 'Esporta localmente',
    subtitle_tagline: 'Le tue storie, ovunque',
  },
  tr: {
    welcome_title: 'Şaşırtıcı bir şey\nyaratabilirsiniz',
    feature_export: 'Yerel olarak dışa aktar',
    subtitle_tagline: 'Hikayeleriniz, her yerde',
  },
  'pt-BR': {
    welcome_title: 'Crie algo\nincrível',
    feature_export: 'Exportar localmente',
    subtitle_tagline: 'Suas histórias, em todo lugar',
  },
  de: {
    welcome_title: 'Erstelle etwas\nErstaunliches',
    feature_export: 'Lokal exportieren',
    subtitle_tagline: 'Deine Geschichten, überall',
  },
  fr: {
    welcome_title: "Créez quelque chose\nd'incroyable",
    feature_export: 'Exporter localement',
    subtitle_tagline: 'Vos histoires, partout',
  },
  ja: {
    welcome_title: '素晴らしいものを\n作成しましょう',
    feature_export: 'ローカルでエクスポート',
    subtitle_tagline: 'あなたの物語を、あらゆる場所へ',
  },
  es: {
    welcome_title: 'Crea algo\nincreíble',
    feature_export: 'Exportar localmente',
    subtitle_tagline: 'Tus historias, en todas partes',
  },
};

/** Example timeline referencing the example catalog keys. */
export const EXAMPLE_TIMELINE = {
  version: TIMELINE_VERSION,
  cues: [
    {
      id: 'intro',
      stringKey: 'welcome_title',
      startTime: 1.5,
      duration: 3,
      horizontalAlign: 'center',
      verticalAlign: 'bottom',
      color: '#FFFFFF',
      fontSize: 72,
    },
    {
      id: 'feature',
      stringKey: 'feature_export',
      startTime: 5,
      duration: 2.5,
      horizontalAlign: 'center',
      verticalAlign: 'middle',
      color: '#FFFFFF',
      fontSize: 60,
    },
    {
      id: 'tagline',
      stringKey: 'subtitle_tagline',
      startTime: 8,
      duration: 4,
      horizontalAlign: 'center',
      verticalAlign: 'top',
      color: '#CCCCCC',
      fontSize: 48,
    },
  ],
};
