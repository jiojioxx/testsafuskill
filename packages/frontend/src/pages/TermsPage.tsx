import { useTranslation } from 'react-i18next';
import Footer from '@/components/Footer';

export default function TermsPage() {
  const { t } = useTranslation('legal');

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 max-w-3xl mx-auto px-10 py-10">
        <article className="docs-content">
          <h1>{t('terms.title')}</h1>
          <p><em>{t('terms.lastUpdated')}</em></p>

          <h3>{t('terms.section1.title')}</h3>
          <p>{t('terms.section1.p1')}</p>

          <h3>{t('terms.section2.title')}</h3>
          <p>{t('terms.section2.p1')}</p>

          <h3>{t('terms.section3.title')}</h3>
          <ul>
            <li>{t('terms.section3.li1')}</li>
            <li>{t('terms.section3.li2')}</li>
            <li>{t('terms.section3.li3')}</li>
          </ul>

          <h3>{t('terms.section4.title')}</h3>
          <ul>
            <li>{t('terms.section4.li1')}</li>
            <li>{t('terms.section4.li2')}</li>
            <li>{t('terms.section4.li3')}</li>
            <li>{t('terms.section4.li4')}</li>
          </ul>

          <h3>{t('terms.section5.title')}</h3>
          <p>{t('terms.section5.p1')}</p>
          <ul>
            <li>{t('terms.section5.li1')}</li>
            <li>{t('terms.section5.li2')}</li>
            <li>{t('terms.section5.li3')}</li>
          </ul>

          <h3>{t('terms.section6.title')}</h3>
          <p>{t('terms.section6.p1')}</p>

          <h3>{t('terms.section7.title')}</h3>
          <p>{t('terms.section7.p1')}</p>
          <ul>
            <li>{t('terms.section7.li1')}</li>
            <li>{t('terms.section7.li2')}</li>
            <li>{t('terms.section7.li3')}</li>
            <li>{t('terms.section7.li4')}</li>
            <li>{t('terms.section7.li5')}</li>
            <li>{t('terms.section7.li6')}</li>
          </ul>

          <h3>{t('terms.section8.title')}</h3>
          <p>{t('terms.section8.p1')}</p>

          <h3>{t('terms.section9.title')}</h3>
          <p>{t('terms.section9.p1')}</p>
          <ul>
            <li>{t('terms.section9.li1')}</li>
            <li>{t('terms.section9.li2')}</li>
            <li>{t('terms.section9.li3')}</li>
          </ul>

          <h3>{t('terms.section10.title')}</h3>
          <p>{t('terms.section10.p1')}</p>

          <h3>{t('terms.section11.title')}</h3>
          <p>{t('terms.section11.p1')}</p>

          <h3>{t('terms.section12.title')}</h3>
          <p>{t('terms.section12.p1')}</p>
        </article>
      </div>
      <Footer />
    </div>
  );
}
