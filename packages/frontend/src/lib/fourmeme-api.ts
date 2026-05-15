import api from '@/lib/api';

export async function getFourMemeNonce(walletAddress: string): Promise<string> {
  const { data } = await api.post('/tokens/fourmeme/nonce', { walletAddress });
  return data.nonce;
}

export async function loginFourMeme(
  walletAddress: string,
  signature: string,
  nonce: string,
): Promise<void> {
  await api.post('/tokens/fourmeme/login', { walletAddress, signature, nonce });
}

export async function checkFourMemeToken(): Promise<boolean> {
  const { data } = await api.get('/tokens/fourmeme/check-token');
  return data.valid === true;
}

export async function uploadFourMemeImage(imageFile: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', imageFile);
  const { data } = await api.post('/tokens/fourmeme/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.imageUrl;
}

export async function getFourMemeSignature(params: {
  name: string;
  symbol: string;
  description?: string;
  imgUrl: string;
  website?: string;
  twitter?: string;
}): Promise<{ createArg: string; signature: string }> {
  const { data } = await api.post('/tokens/fourmeme/signature', params);
  return { createArg: data.createArg, signature: data.signature };
}
