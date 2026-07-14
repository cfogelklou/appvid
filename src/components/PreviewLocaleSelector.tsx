import React from 'react';
import { useProject } from '../context/ProjectContext';
import { Languages } from 'lucide-react';
import './components.css';

export const PreviewLocaleSelector: React.FC = () => {
  const { text, setPreviewLocale } = useProject();

  const locales = Object.keys(text.catalogs);
  if (locales.length === 0) return null;

  const handleLocaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPreviewLocale(e.target.value);
  };

  return (
    <div className='preview-locale-selector'>
      <Languages size={14} />
      <select
        value={text.previewLocale || ''}
        onChange={handleLocaleChange}
        className='locale-select'
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {locale}
          </option>
        ))}
      </select>
    </div>
  );
};
