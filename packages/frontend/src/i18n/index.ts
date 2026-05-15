import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './en/common.json';
import enLanding from './en/landing.json';
import enAuth from './en/auth.json';
import enMarketplace from './en/marketplace.json';
import enLaunchpad from './en/launchpad.json';
import enDashboard from './en/dashboard.json';
import enDocs from './en/docs.json';
import enLegal from './en/legal.json';
import enComponents from './en/components.json';

import zhCommon from './zh-CN/common.json';
import zhLanding from './zh-CN/landing.json';
import zhAuth from './zh-CN/auth.json';
import zhMarketplace from './zh-CN/marketplace.json';
import zhLaunchpad from './zh-CN/launchpad.json';
import zhDashboard from './zh-CN/dashboard.json';
import zhDocs from './zh-CN/docs.json';
import zhLegal from './zh-CN/legal.json';
import zhComponents from './zh-CN/components.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        landing: enLanding,
        auth: enAuth,
        marketplace: enMarketplace,
        launchpad: enLaunchpad,
        dashboard: enDashboard,
        docs: enDocs,
        legal: enLegal,
        components: enComponents,
      },
      'zh-CN': {
        common: zhCommon,
        landing: zhLanding,
        auth: zhAuth,
        marketplace: zhMarketplace,
        launchpad: zhLaunchpad,
        dashboard: zhDashboard,
        docs: zhDocs,
        legal: zhLegal,
        components: zhComponents,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'landing', 'auth', 'marketplace', 'launchpad', 'dashboard', 'docs', 'legal', 'components'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

export default i18n;
