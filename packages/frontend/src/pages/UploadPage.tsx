import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Github, Link } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import Footer from '@/components/Footer';
import { useToast } from '@/components/Toast';
import { mapErrorMessage } from '@/lib/errorMessages';

type UploadType = 'file' | 'github';

export default function UploadPage() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [uploadType, setUploadType] = useState<UploadType>('file');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { showToast(t('upload.selectFile'), 'error'); return; }
    setLoading(true);

    const formData = new FormData();
    formData.append('name', name);
    if (description) formData.append('description', description);
    formData.append('file', file);

    try {
      const { data } = await api.post('/skills', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate(`/skills/${data.id}`);
    } catch (err: any) {
      const errorMsg = mapErrorMessage(err.response?.data?.message, t, 'upload.uploadFailed');
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl) { showToast(t('upload.enterGithubUrl'), 'error'); return; }
    setLoading(true);

    const payload: any = { githubUrl };
    if (name) payload.name = name;
    if (description) payload.description = description;

    try {
      const { data } = await api.post('/skills/from-github', payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      navigate(`/skills/${data.id}`);
    } catch (err: any) {
      const errorMsg = mapErrorMessage(err.response?.data?.message, t, 'upload.importFailed');
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isGithubUrl = (url: string) => {
    return /^https?:\/\/(www\.)?github\.com\/[^\/]+\/[^\/]+/i.test(url);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 px-4 sm:px-6 md:px-10 py-4 md:py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl md:text-[28px] font-bold text-foreground mb-2">{t('upload.title')}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            {t('upload.subtitle')}
          </p>

          {/* Upload Type Tabs */}
          <div className="flex rounded-lg bg-secondary p-1 mb-6">
            <button
              type="button"
              onClick={() => setUploadType('file')}
              className={`flex-1 h-10 flex items-center justify-center gap-2 rounded-md font-medium text-sm transition-colors ${
                uploadType === 'file'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Upload className="w-4 h-4" />
              {t('upload.uploadFile')}
            </button>
            <button
              type="button"
              onClick={() => setUploadType('github')}
              className={`flex-1 h-10 flex items-center justify-center gap-2 rounded-md font-medium text-sm transition-colors ${
                uploadType === 'github'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Github className="w-4 h-4" />
              {t('upload.importGithub')}
            </button>
          </div>

          {/* File Upload Form */}
          {uploadType === 'file' && (
            <form onSubmit={handleFileSubmit} className="flex flex-col gap-6 p-6 rounded-lg border border-border bg-card">
              {/* Name */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">{t('upload.skillName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                  placeholder={t('upload.skillNamePlaceholder')}
                  required
                  maxLength={100}
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">{t('upload.description')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="px-4 py-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors resize-none"
                  placeholder={t('upload.descPlaceholder')}
                  rows={4}
                  maxLength={1000}
                />
              </div>

              {/* File */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">{t('upload.skillFile')}</label>
                <div
                  className={`flex flex-col items-center justify-center gap-3 p-5 md:p-8 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
                    dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => document.getElementById('file-input')?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped && dropped.name.endsWith('.zip')) setFile(dropped);
                  }}
                >
                  {file ? (
                    <>
                      <FileText className="w-8 h-8 text-primary" />
                      <span className="text-sm text-foreground font-medium">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{t('upload.clickToUpload')}</span>
                      <span className="text-xs text-muted-foreground">{t('upload.maxSize')}</span>
                    </>
                  )}
                  <input
                    id="file-input"
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    accept=".zip"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? (
                  t('upload.uploadingScanning')
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {t('upload.uploadScan')}
                  </>
                )}
              </button>
            </form>
          )}

          {/* GitHub URL Import Form */}
          {uploadType === 'github' && (
            <form onSubmit={handleGithubSubmit} className="flex flex-col gap-6 p-6 rounded-lg border border-border bg-card">
              {/* GitHub URL */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">{t('upload.githubUrl')}</label>
                <div className="relative">
                  <Link className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                    placeholder={t('upload.githubPlaceholder')}
                    required
                  />
                </div>
                {githubUrl && !isGithubUrl(githubUrl) && (
                  <p className="text-xs text-muted-foreground">
                    {t('upload.invalidGithubUrl')}
                  </p>
                )}
              </div>

              {/* Name (Optional for GitHub) */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">{t('upload.customName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                  placeholder={t('upload.customNameHint')}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  {t('upload.customNameDetail')}
                </p>
              </div>

              {/* Description (Optional for GitHub) */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">{t('upload.customDesc')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="px-4 py-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors resize-none"
                  placeholder={t('upload.customDescHint')}
                  rows={4}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  {t('upload.customDescDetail')}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || (!!githubUrl && !isGithubUrl(githubUrl))}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? (
                  t('upload.importingScanning')
                ) : (
                  <>
                    <Github className="w-4 h-4" />
                    {t('upload.importScan')}
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
