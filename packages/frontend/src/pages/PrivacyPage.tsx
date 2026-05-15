import { useTranslation } from 'react-i18next';
import Footer from '@/components/Footer';

export default function PrivacyPage() {
  const { t } = useTranslation('legal');

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 max-w-3xl mx-auto px-10 py-10">
        <article className="docs-content">
          <h1>{t('privacy.title')}</h1>
          <p><em>{t('privacy.lastUpdated')}</em></p>

          <h3>{t('privacy.section1.title')}</h3>
          <p>{t('privacy.section1.p1')}</p>

          <h3>{t('privacy.section2.title')}</h3>
          <p>{t('privacy.section2.p1')}</p>
          <ul>
            <li dangerouslySetInnerHTML={{ __html: t('privacy.section2.li1') }} />
            <li dangerouslySetInnerHTML={{ __html: t('privacy.section2.li2') }} />
            <li dangerouslySetInnerHTML={{ __html: t('privacy.section2.li3') }} />
            <li dangerouslySetInnerHTML={{ __html: t('privacy.section2.li4') }} />
          </ul>

          <h3>{t('privacy.section3.title')}</h3>
          <ul>
            <li>{t('privacy.section3.li1')}</li>
            <li>{t('privacy.section3.li2')}</li>
            <li>{t('privacy.section3.li3')}</li>
            <li>{t('privacy.section3.li4')}</li>
            <li>{t('privacy.section3.li5')}</li>
          </ul>

          <h3>{t('privacy.section4.title')}</h3>
          <p>{t('privacy.section4.p1')}</p>

          <h3>{t('privacy.section5.title')}</h3>
          <p>{t('privacy.section5.p1')}</p>
          <ul>
            <li dangerouslySetInnerHTML={{ __html: t('privacy.section5.li1') }} />
            <li dangerouslySetInnerHTML={{ __html: t('privacy.section5.li2') }} />
          </ul>

          <h3>{t('privacy.section6.title')}</h3>
          <p>{t('privacy.section6.p1')}</p>

          <h3>{t('privacy.section7.title')}</h3>
          <p>{t('privacy.section7.p1')}</p>

          <h3>{t('privacy.section8.title')}</h3>
          <ul>
            <li>{t('privacy.section8.li1')}</li>
            <li>{t('privacy.section8.li2')}</li>
            <li>{t('privacy.section8.li3')}</li>
          </ul>

          <h3>{t('privacy.section9.title')}</h3>
          <p>{t('privacy.section9.p1')}</p>

          <h3>{t('privacy.section10.title')}</h3>
          <p>{t('privacy.section10.p1')}</p>

          <h3>{t('privacy.section11.title')}</h3>
          <p>{t('privacy.section11.p1')}</p>
        </article>
      </div>
      <Footer />
    </div>
  );
}
