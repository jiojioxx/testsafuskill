import { useState } from 'react';
import { X, Upload, Github, FileText, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import { mapErrorMessage } from '@/lib/errorMessages';

interface Skill {
  id: string;
  name: string;
  description?: string;
  authorName?: string;
  sourceRepo?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (skill: Skill) => void;
}

type UploadType = 'file' | 'github';

export default function UploadSkillModal({ isOpen, onClose, onSuccess }: Props) {
  const { t } = useTranslation('dashboard');
  const { showToast } = useToast();
  const [uploadType, setUploadType] = useState<UploadType>('file');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setName('');
    setDescription('');
    setFile(null);
    setGithubUrl('');
    setUploadType('file');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isGithubUrl = (url: string) =>
    /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/i.test(url);

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
      reset();
      onSuccess(data);
    } catch (err: any) {
      showToast(mapErrorMessage(err.response?.data?.message, t, 'upload.uploadFailed'), 'error');
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
      const { data } = await api.post('/skills/from-github', payload);
      reset();
      onSuccess(data);
    } catch (err: any) {
      showToast(mapErrorMessage(err.response?.data?.message, t, 'upload.importFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('upload.title')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('upload.subtitle').split('GoPlus AgentGuard')[0]}
              <span className="text-primary">GoPlus AgentGuard</span>
              {t('upload.subtitle').split('GoPlus AgentGuard')[1]}
            </p>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground ml-4 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          <div className="flex rounded-lg bg-secondary p-1">
            <button
              type="button"
              onClick={() => setUploadType('file')}
              className={`flex-1 h-9 flex items-center justify-center gap-2 rounded-md font-medium text-sm transition-colors ${
                uploadType === 'file' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Upload className="w-4 h-4" />
              {t('upload.uploadFile')}
            </button>
            <button
              type="button"
              onClick={() => setUploadType('github')}
              className={`flex-1 h-9 flex items-center justify-center gap-2 rounded-md font-medium text-sm transition-colors ${
                uploadType === 'github' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Github className="w-4 h-4" />
              {t('upload.importGithub')}
            </button>
          </div>

          {uploadType === 'file' && (
            <form onSubmit={handleFileSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t('upload.skillName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                  placeholder={t('upload.skillNamePlaceholder')}
                  required
                  maxLength={100}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t('upload.description')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors resize-none"
                  placeholder={t('upload.descPlaceholder')}
                  rows={3}
                  maxLength={1000}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t('upload.skillFile')}</label>
                <div
                  className={`flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
                    dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => document.getElementById('modal-file-input')?.click()}
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
                      <FileText className="w-7 h-7 text-primary" />
                      <span className="text-sm text-foreground font-medium">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{t('upload.clickToUpload')}</span>
                      <span className="text-xs text-muted-foreground">{t('upload.maxSize')}</span>
                    </>
                  )}
                  <input
                    id="modal-file-input"
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
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {loading ? t('upload.uploadingScanning') : t('upload.uploadScan')}
              </button>
            </form>
          )}

          {uploadType === 'github' && (
            <form onSubmit={handleGithubSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t('upload.githubUrl')}</label>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                  placeholder={t('upload.githubPlaceholder')}
                  required
                />
                {githubUrl && !isGithubUrl(githubUrl) && (
                  <p className="text-xs text-muted-foreground">{t('upload.invalidGithubUrl')}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t('upload.customName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                  placeholder={t('upload.customNameHint')}
                  maxLength={100}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t('upload.customDesc')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors resize-none"
                  placeholder={t('upload.customDescHint')}
                  rows={3}
                  maxLength={1000}
                />
              </div>
              <button
                type="submit"
                disabled={loading || (!!githubUrl && !isGithubUrl(githubUrl))}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                {loading ? t('upload.importingScanning') : t('upload.importScan')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
