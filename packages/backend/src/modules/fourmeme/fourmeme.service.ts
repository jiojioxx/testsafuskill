import { Injectable, Logger, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

const FOUR_MEME_BASE = 'https://four.meme/meme-api/v1/private';

interface FourMemeCreateParams {
  name: string;
  shortName: string;
  symbol: string;
  desc?: string;
  imgUrl: string;
  launchTime: number;
  label: string;
  lpTradingFee: number;
  webUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  preSale: string;
  raisedAmount: string;
  onlyMPC: boolean;
  feePlan: boolean;
  raisedToken: {
    symbol: string;
    nativeSymbol: string;
    symbolAddress: string;
    deployCost: string;
    buyFee: string;
    sellFee: string;
    minTradeFee: string;
    b0Amount: string;
    totalBAmount: string;
    totalAmount: string;
    logoUrl?: string;
    tradeLevel: string[];
    status: string;
    buyTokenLink?: string;
    reservedNumber: number;
    saleRate: string;
    networkCode: string;
    platform: string;
  };
}

@Injectable()
export class FourmemeService {
  private readonly logger = new Logger(FourmemeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getNonce(walletAddress: string): Promise<string> {
    this.logger.log(`[four.meme] getNonce wallet=${walletAddress}`);
    const res = await fetch(`${FOUR_MEME_BASE}/user/nonce/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountAddress: walletAddress,
        verifyType: 'LOGIN',
        networkCode: 'BSC',
      }),
    });

    const json = await res.json() as any;
    this.logger.log(`[four.meme] getNonce response: status=${res.status} body=${JSON.stringify(json)}`);
    if (!res.ok || (json?.code !== undefined && json.code !== 0)) {
      throw new BadRequestException(json?.msg || json?.message || 'Failed to get four.meme nonce');
    }

    return json?.data?.nonce || json?.data || json?.nonce;
  }

  async login(userId: string, walletAddress: string, signature: string, nonce: string): Promise<string> {
    this.logger.log(`[four.meme] login user=${userId} wallet=${walletAddress} nonce=${nonce}`);
    const res = await fetch(`${FOUR_MEME_BASE}/user/login/dex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        region: 'WEB',
        langType: 'EN',
        loginIp: '',
        inviteCode: '',
        verifyInfo: {
          address: walletAddress,
          networkCode: 'BSC',
          signature,
          verifyType: 'LOGIN',
        },
        walletName: 'MetaMask',
      }),
    });

    const json = await res.json() as any;
    this.logger.log(`[four.meme] login response: status=${res.status} body=${JSON.stringify(json).slice(0, 500)}`);
    if (!res.ok || (json?.code !== undefined && json.code !== 0)) {
      throw new BadRequestException(json?.msg || json?.message || 'Failed to login to four.meme');
    }

    const accessToken =
      (typeof json?.data === 'string' ? json.data : null) ||
      json?.data?.accessToken || json?.data?.access_token || json?.data?.token ||
      json?.access_token || json?.token;
    if (!accessToken) {
      throw new BadRequestException('four.meme login returned no access token');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { fourMemeAccessToken: accessToken },
    });

    return accessToken;
  }

  async checkAccessToken(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fourMemeAccessToken: true },
    });

    if (!user?.fourMemeAccessToken) return false;

    try {
      await this.getAuthHeaders(userId);
      return true;
    } catch {
      return false;
    }
  }

  async uploadImage(userId: string, file: Express.Multer.File): Promise<string> {
    this.logger.log(`[four.meme] uploadImage user=${userId} name=${file.originalname} size=${file.size} type=${file.mimetype}`);
    const headers = await this.getAuthHeaders(userId);
    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'application/octet-stream' });
    form.append('file', blob, file.originalname || 'token-image');

    const res = await fetch(`${FOUR_MEME_BASE}/token/upload`, {
      method: 'POST',
      headers,
      body: form,
    });

    const json = await res.json() as any;
    this.logger.log(`[four.meme] uploadImage response: status=${res.status} body=${JSON.stringify(json).slice(0, 500)}`);
    if (res.status === 401) {
      await this.clearAccessToken(userId);
      throw new UnauthorizedException('four.meme access token expired');
    }
    if (!res.ok) {
      throw new BadRequestException(json?.message || 'Failed to upload image to four.meme');
    }

    const imageUrl = json?.data?.url || json?.data?.imgUrl || json?.url || json?.imgUrl || json?.data;
    if (!imageUrl) {
      throw new BadRequestException('four.meme upload returned no image URL');
    }

    return imageUrl;
  }

  async getCreateSignature(userId: string, params: FourMemeCreateParams): Promise<{ createArg: string; signature: string }> {
    this.logger.log(`[four.meme] getCreateSignature user=${userId} symbol=${params.shortName} imgUrl=${params.imgUrl}`);
    this.logger.debug(`[four.meme] getCreateSignature body=${JSON.stringify(params)}`);
    const headers = await this.getAuthHeaders(userId);
    headers.set('Content-Type', 'application/json');

    const res = await fetch(`${FOUR_MEME_BASE}/token/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const json = await res.json() as any;
    this.logger.log(`[four.meme] getCreateSignature response: status=${res.status} body=${JSON.stringify(json).slice(0, 500)}`);
    if (res.status === 401) {
      await this.clearAccessToken(userId);
      throw new UnauthorizedException('four.meme access token expired');
    }
    if (!res.ok) {
      throw new BadRequestException(json?.message || 'Failed to get four.meme create signature');
    }

    const createArg = json?.data?.createArg || json?.data?.createArgs || json?.createArg;
    const signature = json?.data?.signature || json?.signature;
    if (!createArg || !signature) {
      throw new BadRequestException('four.meme create response missing createArg or signature');
    }

    return { createArg, signature };
  }

  buildCreateParams(input: {
    name: string;
    symbol: string;
    description?: string;
    imgUrl: string;
    website?: string;
    twitter?: string;
  }): FourMemeCreateParams {
    const params: FourMemeCreateParams = {
      name: input.name,
      shortName: input.symbol,
      symbol: 'BNB',
      desc: input.description || '',
      imgUrl: input.imgUrl,
      launchTime: Date.now(),
      label: 'AI',
      lpTradingFee: 0.0025,
      preSale: '0',
      raisedAmount: '24',
      onlyMPC: false,
      feePlan: false,
      raisedToken: {
        symbol: 'BNB',
        nativeSymbol: 'BNB',
        symbolAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        deployCost: '0',
        buyFee: '0.01',
        sellFee: '0.01',
        minTradeFee: '0',
        b0Amount: '8',
        totalBAmount: '24',
        totalAmount: '1000000000',
        logoUrl: input.imgUrl,
        tradeLevel: ['0.1', '0.5', '1'],
        status: 'PUBLISH',
        reservedNumber: 10,
        saleRate: '0.8',
        networkCode: 'BSC',
        platform: 'MEME',
      },
    };
    if (input.website) params.webUrl = input.website;
    if (input.twitter) params.twitterUrl = input.twitter;
    return params;
  }

  private async getAuthHeaders(userId: string): Promise<Headers> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fourMemeAccessToken: true },
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.fourMemeAccessToken) {
      throw new UnauthorizedException('Missing four.meme access token');
    }

    const headers = new Headers();
    headers.set('meme-web-access', user.fourMemeAccessToken);
    return headers;
  }

  private async clearAccessToken(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fourMemeAccessToken: null },
    }).catch((err) => {
      this.logger.warn(`Failed to clear four.meme access token for user ${userId}: ${err?.message || err}`);
    });
  }
}
