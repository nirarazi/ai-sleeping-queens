import React from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage || i18n.language;
  
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const isActive = (lng: string) => currentLanguage?.startsWith(lng);

  return (
    <div className="language-switcher">
      <button onClick={() => changeLanguage('en')} disabled={isActive('en')} aria-label="Switch to English">🇺🇸</button>
      <button onClick={() => changeLanguage('es')} disabled={isActive('es')} aria-label="Switch to Spanish">🇪🇸</button>
      <button onClick={() => changeLanguage('fr')} disabled={isActive('fr')} aria-label="Switch to French">🇫🇷</button>
      <button onClick={() => changeLanguage('he')} disabled={isActive('he')} aria-label="Switch to Hebrew">🇮🇱</button>
    </div>
  );
};

