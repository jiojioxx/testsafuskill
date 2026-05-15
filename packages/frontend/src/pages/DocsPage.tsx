import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, BookOpen, Shield, Code, Upload, Search } from 'lucide-react';
import Footer from '@/components/Footer';

/* ── Sidebar sections ── */
interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: { id: string; title: string }[];
}

/* ── Content data ── */

export default function DocsPage() {
  const { t } = useTranslation('docs');
  const [activeItem, setActiveItem] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sections: DocSection[] = [
    {
      id: 'getting-started',
      title: t('sections.gettingStarted.title'),
      icon: <BookOpen className="w-4 h-4" />,
      items: [
        { id: 'overview', title: t('sections.gettingStarted.items.overview') },
        { id: 'connect-wallet', title: t('sections.gettingStarted.items.connectWallet') },
        { id: 'navigation', title: t('sections.gettingStarted.items.navigation') },
      ],
    },
    {
      id: 'marketplace',
      title: t('sections.marketplace.title'),
      icon: <Search className="w-4 h-4" />,
      items: [
        { id: 'browse-skills', title: t('sections.marketplace.items.browseSkills') },
        { id: 'categories', title: t('sections.marketplace.items.categories') },
        { id: 'skill-detail', title: t('sections.marketplace.items.skillDetail') },
        { id: 'install-skill', title: t('sections.marketplace.items.installSkill') },
      ],
    },
    {
      id: 'security',
      title: t('sections.security.title'),
      icon: <Shield className="w-4 h-4" />,
      items: [
        { id: 'how-scanning-works', title: t('sections.security.items.howScanningWorks') },
        { id: 'risk-levels', title: t('sections.security.items.riskLevels') },
        { id: 'scan-report', title: t('sections.security.items.scanReport') },
      ],
    },
    {
      id: 'publishing',
      title: t('sections.publishing.title'),
      icon: <Upload className="w-4 h-4" />,
      items: [
        { id: 'upload-skill', title: t('sections.publishing.items.uploadSkill') },
        { id: 'skill-requirements', title: t('sections.publishing.items.skillRequirements') },
        { id: 'manage-skills', title: t('sections.publishing.items.manageSkills') },
      ],
    },
    {
      id: 'developer',
      title: t('sections.developer.title'),
      icon: <Code className="w-4 h-4" />,
      items: [
        { id: 'developer-dashboard', title: t('sections.developer.items.developerDashboard') },
        { id: 'analytics', title: t('sections.developer.items.analytics') },
        { id: 'api-reference', title: t('sections.developer.items.apiReference') },
      ],
    },
  ];

  const content: Record<string, { title: string; body: React.ReactNode }> = {
    overview: {
      title: t('content.overview.title'),
      body: (
        <>
          <p>{t('content.overview.p1')}</p>
          <h3>{t('content.overview.keyFeaturesTitle')}</h3>
          <ul>
            <li><strong>{t('content.overview.featureMarketplace')}</strong> — {t('content.overview.featureMarketplaceDesc')}</li>
            <li><strong>{t('content.overview.featureScanning')}</strong> — {t('content.overview.featureScanningDesc')}</li>
            <li><strong>{t('content.overview.featureDashboard')}</strong> — {t('content.overview.featureDashboardDesc')}</li>
          </ul>
          <h3>{t('content.overview.whoIsItForTitle')}</h3>
          <ul>
            <li><strong>{t('content.overview.forUsers')}</strong> — {t('content.overview.forUsersDesc')}</li>
            <li><strong>{t('content.overview.forDevs')}</strong> — {t('content.overview.forDevsDesc')}</li>
          </ul>
        </>
      ),
    },
    'connect-wallet': {
      title: t('content.connectWallet.title'),
      body: (
        <>
          <p>{t('content.connectWallet.p1')}</p>
          <h3>{t('content.connectWallet.supportedWalletsTitle')}</h3>
          <ul>
            <li>{t('content.connectWallet.wallet1')}</li>
            <li>{t('content.connectWallet.wallet2')}</li>
            <li>{t('content.connectWallet.wallet3')}</li>
            <li>{t('content.connectWallet.wallet4')}</li>
          </ul>
          <h3>{t('content.connectWallet.stepsTitle')}</h3>
          <ol>
            <li dangerouslySetInnerHTML={{ __html: t('content.connectWallet.step1') }} />
            <li>{t('content.connectWallet.step2')}</li>
            <li>{t('content.connectWallet.step3')}</li>
            <li>{t('content.connectWallet.step4')}</li>
          </ol>
          <div className="callout">
            <strong>{t('content.connectWallet.noteLabel')}</strong>{' '}
            <span dangerouslySetInnerHTML={{ __html: t('content.connectWallet.noteText') }} />
          </div>
        </>
      ),
    },
    navigation: {
      title: t('content.navigation.title'),
      body: (
        <>
          <p>{t('content.navigation.p1')}</p>
          <ul>
            <li><strong>{t('content.navigation.navMarketplace')}</strong> — {t('content.navigation.navMarketplaceDesc')}</li>
            <li><strong>{t('content.navigation.navDevelopers')}</strong> — {t('content.navigation.navDevelopersDesc')}</li>
            <li><strong>{t('content.navigation.navDocs')}</strong> — {t('content.navigation.navDocsDesc')}</li>
          </ul>
          <p>{t('content.navigation.p2')}</p>
        </>
      ),
    },
    'browse-skills': {
      title: t('content.browseSkills.title'),
      body: (
        <>
          <p dangerouslySetInnerHTML={{ __html: t('content.browseSkills.p1') }} />
          <h3>{t('content.browseSkills.searchingTitle')}</h3>
          <p>{t('content.browseSkills.searchingDesc')}</p>
          <h3>{t('content.browseSkills.sortingTitle')}</h3>
          <p>{t('content.browseSkills.sortingDesc')}</p>
          <ul>
            <li><strong>{t('content.browseSkills.sortStars')}</strong> — {t('content.browseSkills.sortStarsDesc')}</li>
            <li><strong>{t('content.browseSkills.sortUpdated')}</strong> — {t('content.browseSkills.sortUpdatedDesc')}</li>
            <li><strong>{t('content.browseSkills.sortRated')}</strong> — {t('content.browseSkills.sortRatedDesc')}</li>
            <li><strong>{t('content.browseSkills.sortDownloads')}</strong> — {t('content.browseSkills.sortDownloadsDesc')}</li>
          </ul>
          <h3>{t('content.browseSkills.paginationTitle')}</h3>
          <p>{t('content.browseSkills.paginationDesc')}</p>
        </>
      ),
    },
    categories: {
      title: t('content.categories.title'),
      body: (
        <>
          <p>{t('content.categories.p1')}</p>
          <ul>
            <li><strong>{t('content.categories.catBNBChain')}</strong> — {t('content.categories.catBNBChainDesc')}</li>
            <li><strong>{t('content.categories.catAll')}</strong> — {t('content.categories.catAllDesc')}</li>
            <li><strong>{t('content.categories.catDevTools')}</strong> — {t('content.categories.catDevToolsDesc')}</li>
            <li><strong>{t('content.categories.catBlockchain')}</strong> — {t('content.categories.catBlockchainDesc')}</li>
            <li><strong>{t('content.categories.catSecurity')}</strong> — {t('content.categories.catSecurityDesc')}</li>
            <li><strong>{t('content.categories.catData')}</strong> — {t('content.categories.catDataDesc')}</li>
            <li><strong>{t('content.categories.catDevOps')}</strong> — {t('content.categories.catDevOpsDesc')}</li>
            <li><strong>{t('content.categories.catProductivity')}</strong> — {t('content.categories.catProductivityDesc')}</li>
            <li><strong>{t('content.categories.catOther')}</strong> — {t('content.categories.catOtherDesc')}</li>
          </ul>
          <p dangerouslySetInnerHTML={{ __html: t('content.categories.p2') }} />
        </>
      ),
    },
    'skill-detail': {
      title: t('content.skillDetail.title'),
      body: (
        <>
          <p>{t('content.skillDetail.p1')}</p>
          <ul>
            <li><strong>{t('content.skillDetail.readme')}</strong> — {t('content.skillDetail.readmeDesc')}</li>
            <li><strong>{t('content.skillDetail.securityScan')}</strong> — {t('content.skillDetail.securityScanDesc')}</li>
            <li><strong>{t('content.skillDetail.metadata')}</strong> — {t('content.skillDetail.metadataDesc')}</li>
            <li><strong>{t('content.skillDetail.sourceLink')}</strong> — {t('content.skillDetail.sourceLinkDesc')}</li>
            <li><strong>{t('content.skillDetail.download')}</strong> — {t('content.skillDetail.downloadDesc')}</li>
          </ul>
        </>
      ),
    },
    'install-skill': {
      title: t('content.installSkill.title'),
      body: (
        <>
          <p>{t('content.installSkill.p1')}</p>
          <ol>
            <li>{t('content.installSkill.step1')}</li>
            <li dangerouslySetInnerHTML={{ __html: t('content.installSkill.step2') }} />
            <li dangerouslySetInnerHTML={{ __html: t('content.installSkill.step3') }} />
            <li>{t('content.installSkill.step4')}</li>
          </ol>
          <div className="callout warning">
            <strong>{t('content.installSkill.warningLabel')}</strong>{' '}
            <span dangerouslySetInnerHTML={{ __html: t('content.installSkill.warningText') }} />
          </div>
        </>
      ),
    },
    'how-scanning-works': {
      title: t('content.howScanningWorks.title'),
      body: (
        <>
          <p dangerouslySetInnerHTML={{ __html: t('content.howScanningWorks.p1') }} />
          <ul>
            <li><strong>{t('content.howScanningWorks.threatMalicious')}</strong> — {t('content.howScanningWorks.threatMaliciousDesc')}</li>
            <li><strong>{t('content.howScanningWorks.threatCredentials')}</strong> — {t('content.howScanningWorks.threatCredentialsDesc')}</li>
            <li><strong>{t('content.howScanningWorks.threatPrompt')}</strong> — {t('content.howScanningWorks.threatPromptDesc')}</li>
            <li><strong>{t('content.howScanningWorks.threatExfiltration')}</strong> — {t('content.howScanningWorks.threatExfiltrationDesc')}</li>
            <li><strong>{t('content.howScanningWorks.threatPermission')}</strong> — {t('content.howScanningWorks.threatPermissionDesc')}</li>
            <li><strong>{t('content.howScanningWorks.threatCommands')}</strong> — {t('content.howScanningWorks.threatCommandsDesc')}</li>
          </ul>
          <p>{t('content.howScanningWorks.p2')}</p>
        </>
      ),
    },
    'risk-levels': {
      title: t('content.riskLevels.title'),
      body: (
        <>
          <p>{t('content.riskLevels.p1')}</p>
          <div className="risk-table">
            <div className="risk-row safe">
              <span className="risk-badge safe">{t('content.riskLevels.safe')}</span>
              <span className="risk-label">{t('content.riskLevels.safeSeverity')}</span>
              <span>{t('content.riskLevels.safeDesc')}</span>
            </div>
            <div className="risk-row caution">
              <span className="risk-badge caution">{t('content.riskLevels.caution')}</span>
              <span className="risk-label">{t('content.riskLevels.cautionSeverity')}</span>
              <span>{t('content.riskLevels.cautionDesc')}</span>
            </div>
            <div className="risk-row risky">
              <span className="risk-badge risky">{t('content.riskLevels.risky')}</span>
              <span className="risk-label">{t('content.riskLevels.riskySeverity')}</span>
              <span>{t('content.riskLevels.riskyDesc')}</span>
            </div>
            <div className="risk-row dangerous">
              <span className="risk-badge dangerous">{t('content.riskLevels.dangerous')}</span>
              <span className="risk-label">{t('content.riskLevels.dangerousSeverity')}</span>
              <span>{t('content.riskLevels.dangerousDesc')}</span>
            </div>
          </div>
        </>
      ),
    },
    'scan-report': {
      title: t('content.scanReport.title'),
      body: (
        <>
          <p>{t('content.scanReport.p1')}</p>
          <ul>
            <li><strong>{t('content.scanReport.overallRisk')}</strong> — {t('content.scanReport.overallRiskDesc')}</li>
            <li><strong>{t('content.scanReport.findingsList')}</strong> — {t('content.scanReport.findingsListDesc')}</li>
            <li><strong>{t('content.scanReport.safeToUse')}</strong> — {t('content.scanReport.safeToUseDesc')}</li>
            <li><strong>{t('content.scanReport.scanDate')}</strong> — {t('content.scanReport.scanDateDesc')}</li>
          </ul>
          <p>{t('content.scanReport.p2')}</p>
        </>
      ),
    },
    'upload-skill': {
      title: t('content.uploadSkill.title'),
      body: (
        <>
          <p>{t('content.uploadSkill.p1')}</p>
          <ol>
            <li><strong>{t('content.uploadSkill.step1')}</strong> — {t('content.uploadSkill.step1Desc')}</li>
            <li dangerouslySetInnerHTML={{ __html: t('content.uploadSkill.step2') }} />
            <li dangerouslySetInnerHTML={{ __html: t('content.uploadSkill.step3') }} />
            <li>{t('content.uploadSkill.step4')}</li>
            <li>{t('content.uploadSkill.step5')}</li>
          </ol>
          <p>{t('content.uploadSkill.p2')}</p>
        </>
      ),
    },
    'skill-requirements': {
      title: t('content.skillRequirements.title'),
      body: (
        <>
          <p>{t('content.skillRequirements.p1')}</p>
          <ul>
            <li><strong>{t('content.skillRequirements.reqPublicRepo')}</strong> — {t('content.skillRequirements.reqPublicRepoDesc')}</li>
            <li><strong>{t('content.skillRequirements.reqReadme')}</strong> — {t('content.skillRequirements.reqReadmeDesc')}</li>
            <li><strong>{t('content.skillRequirements.reqStars')}</strong> — {t('content.skillRequirements.reqStarsDesc')}</li>
            <li><strong>{t('content.skillRequirements.reqTopics')}</strong> — <span dangerouslySetInnerHTML={{ __html: t('content.skillRequirements.reqTopicsDesc') }} /></li>
          </ul>
          <h3>{t('content.skillRequirements.recommendedTitle')}</h3>
          <ul>
            <li dangerouslySetInnerHTML={{ __html: t('content.skillRequirements.rec1') }} />
            <li dangerouslySetInnerHTML={{ __html: t('content.skillRequirements.rec2') }} />
            <li>{t('content.skillRequirements.rec3')}</li>
            <li>{t('content.skillRequirements.rec4')}</li>
          </ul>
        </>
      ),
    },
    'manage-skills': {
      title: t('content.manageSkills.title'),
      body: (
        <>
          <p dangerouslySetInnerHTML={{ __html: t('content.manageSkills.p1') }} />
          <h3>{t('content.manageSkills.dashboardFeaturesTitle')}</h3>
          <ul>
            <li>{t('content.manageSkills.feat1')}</li>
            <li>{t('content.manageSkills.feat2')}</li>
            <li>{t('content.manageSkills.feat3')}</li>
            <li>{t('content.manageSkills.feat4')}</li>
          </ul>
        </>
      ),
    },
    'developer-dashboard': {
      title: t('content.developerDashboard.title'),
      body: (
        <>
          <p dangerouslySetInnerHTML={{ __html: t('content.developerDashboard.p1') }} />
          <h3>{t('content.developerDashboard.dashboardSectionsTitle')}</h3>
          <ul>
            <li><strong>{t('content.developerDashboard.secOverview')}</strong> — {t('content.developerDashboard.secOverviewDesc')}</li>
            <li><strong>{t('content.developerDashboard.secMySkills')}</strong> — {t('content.developerDashboard.secMySkillsDesc')}</li>
            <li><strong>{t('content.developerDashboard.secUpload')}</strong> — {t('content.developerDashboard.secUploadDesc')}</li>
            <li><strong>{t('content.developerDashboard.secAnalytics')}</strong> — {t('content.developerDashboard.secAnalyticsDesc')}</li>
            <li><strong>{t('content.developerDashboard.secSettings')}</strong> — {t('content.developerDashboard.secSettingsDesc')}</li>
          </ul>
        </>
      ),
    },
    analytics: {
      title: t('content.analytics.title'),
      body: (
        <>
          <p>{t('content.analytics.p1')}</p>
          <ul>
            <li><strong>{t('content.analytics.downloadTrends')}</strong> — {t('content.analytics.downloadTrendsDesc')}</li>
            <li><strong>{t('content.analytics.securityOverview')}</strong> — {t('content.analytics.securityOverviewDesc')}</li>
            <li><strong>{t('content.analytics.userEngagement')}</strong> — {t('content.analytics.userEngagementDesc')}</li>
          </ul>
        </>
      ),
    },
    'api-reference': {
      title: t('content.apiReference.title'),
      body: (
        <>
          <p>{t('content.apiReference.p1')}</p>
          <h3>{t('content.apiReference.endpointsTitle')}</h3>
          <div className="api-block">
            <div className="api-row">
              <code className="method get">GET</code>
              <code>/api/skills</code>
              <span>{t('content.apiReference.endpointSkillsList')}</span>
            </div>
            <div className="api-row">
              <code className="method get">GET</code>
              <code>/api/skills/:id</code>
              <span>{t('content.apiReference.endpointSkillsDetail')}</span>
            </div>
            <div className="api-row">
              <code className="method get">GET</code>
              <code>/api/most-starred</code>
              <span>{t('content.apiReference.endpointMostStarred')}</span>
            </div>
            <div className="api-row">
              <code className="method get">GET</code>
              <code>/api/top-rated</code>
              <span>{t('content.apiReference.endpointTopRated')}</span>
            </div>
            <div className="api-row">
              <code className="method get">GET</code>
              <code>/api/recently-updated</code>
              <span>{t('content.apiReference.endpointRecentlyUpdated')}</span>
            </div>
            <div className="api-row">
              <code className="method get">GET</code>
              <code>/api/trending</code>
              <span>{t('content.apiReference.endpointTrending')}</span>
            </div>
            <div className="api-row">
              <code className="method get">GET</code>
              <code>/api/landing-data</code>
              <span>{t('content.apiReference.endpointLandingData')}</span>
            </div>
            <div className="api-row">
              <code className="method post">POST</code>
              <code>/api/submit-skill</code>
              <span>{t('content.apiReference.endpointSubmitSkill')}</span>
            </div>
            <div className="api-row">
              <code className="method get">GET</code>
              <code>/api/stats</code>
              <span>{t('content.apiReference.endpointStats')}</span>
            </div>
          </div>
          <h3>{t('content.apiReference.queryParamsTitle')}</h3>
          <ul>
            <li dangerouslySetInnerHTML={{ __html: t('content.apiReference.paramLimit') }} />
            <li dangerouslySetInnerHTML={{ __html: t('content.apiReference.paramOffset') }} />
            <li dangerouslySetInnerHTML={{ __html: t('content.apiReference.paramCategory') }} />
            <li dangerouslySetInnerHTML={{ __html: t('content.apiReference.paramPage') }} />
          </ul>
        </>
      ),
    },
  };

  const activeSection = sections.find((s) => s.items.some((i) => i.id === activeItem));
  const activeContent = content[activeItem];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Mobile doc nav toggle */}
      <div className="md:hidden sticky top-14 z-30 bg-[#0B0E11] border-b border-border px-4 py-2">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${sidebarOpen ? 'rotate-90' : ''}`} />
          {activeContent?.title || t('fallbackTitle')}
        </button>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-[260px] shrink-0 border-r border-border bg-[#0B0E11] overflow-y-auto md:sticky md:top-16 md:h-[calc(100vh-4rem)] ${sidebarOpen ? 'fixed inset-0 top-[6.5rem] z-20' : ''}`}>
          <div className="px-4 md:px-5 py-4 md:py-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('sidebarTitle')}</h2>
            <nav className="flex flex-col gap-1">
              {sections.map((section) => (
                <div key={section.id} className="mb-2">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {section.icon}
                    {section.title}
                  </div>
                  <div className="flex flex-col gap-0.5 ml-2">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setActiveItem(item.id); setSidebarOpen(false); }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors text-left w-full ${
                          activeItem === item.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                        }`}
                      >
                        <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${activeItem === item.id ? 'rotate-90 text-primary' : ''}`} />
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-6 md:py-10">
            {/* Breadcrumb */}
            {activeSection && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
                <Link to="/docs" className="hover:text-foreground transition-colors">{t('breadcrumbDocs')}</Link>
                <ChevronRight className="w-3 h-3" />
                <span>{activeSection.title}</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground">{activeContent?.title}</span>
              </div>
            )}

            {/* Content */}
            {activeContent && (
              <article className="docs-content">
                <h1>{activeContent.title}</h1>
                {activeContent.body}
              </article>
            )}

            {/* Nav footer */}
            <div className="flex items-center justify-between mt-12 pt-6 border-t border-border">
              {(() => {
                const allItems = sections.flatMap((s) => s.items);
                const idx = allItems.findIndex((i) => i.id === activeItem);
                const prev = idx > 0 ? allItems[idx - 1] : null;
                const next = idx < allItems.length - 1 ? allItems[idx + 1] : null;
                return (
                  <>
                    {prev ? (
                      <button onClick={() => setActiveItem(prev.id)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        &larr; {prev.title}
                      </button>
                    ) : <div />}
                    {next ? (
                      <button onClick={() => setActiveItem(next.id)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        {next.title} &rarr;
                      </button>
                    ) : <div />}
                  </>
                );
              })()}
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
