import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { safeImageUrl } from '../common/utils/crypto.util';
import { PrismaService } from '../database/prisma.service';

export interface StoreUpdate {
  storeName?: string;
  description?: string | null;
  logoUrl?: string | null;
  businessContact?: string | null;
}

const publicSellerSelect = {
  id: true,
  storeName: true,
  storeSlug: true,
  description: true,
  logoUrl: true,
  approvalStatus: true,
  approvedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class SellersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnProfile(userId: string) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');
    return seller;
  }

  async requireApprovedSeller(userId: string) {
    const seller = await this.getOwnProfile(userId);
    if (seller.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException(
        seller.approvalStatus === 'SUSPENDED'
          ? 'Your store is suspended. Contact marketplace support.'
          : seller.approvalStatus === 'REJECTED'
            ? 'Your seller application was rejected. Contact marketplace support.'
            : 'Your seller application is still awaiting administrator approval.',
      );
    }
    return seller;
  }

  async updateProfile(userId: string, dto: StoreUpdate) {
    const seller = await this.getOwnProfile(userId);
    if (seller.approvalStatus === 'SUSPENDED') {
      throw new ForbiddenException('Suspended stores cannot edit their profile');
    }
    let logoUrl: string | null | undefined;
    if (dto.logoUrl !== undefined) {
      if (dto.logoUrl === null || dto.logoUrl.trim() === '') {
        logoUrl = null;
      } else {
        logoUrl = safeImageUrl(dto.logoUrl);
        if (!logoUrl) {
          throw new BadRequestException('logoUrl must be a valid http(s) image URL');
        }
      }
    }
    return this.prisma.sellerProfile.update({
      where: { id: seller.id },
      data: {
        ...(dto.storeName !== undefined ? { storeName: dto.storeName.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(dto.businessContact !== undefined
          ? { businessContact: dto.businessContact?.trim() || null }
          : {}),
      },
    });
  }

  async listPublic() {
    const items = await this.prisma.sellerProfile.findMany({
      where: { approvalStatus: 'APPROVED' },
      select: {
        ...publicSellerSelect,
        _count: {
          select: {
            products: {
              where: { status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] } },
            },
          },
        },
      },
      orderBy: { approvedAt: 'desc' },
      take: 60,
    });
    return {
      items: items.map(({ _count, ...seller }) => ({
        ...seller,
        productCount: _count.products,
      })),
    };
  }

  async getPublicStore(slug: string) {
    const seller = await this.prisma.sellerProfile.findFirst({
      where: { storeSlug: slug, approvalStatus: 'APPROVED' },
      select: {
        ...publicSellerSelect,
        _count: {
          select: {
            products: {
              where: { status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] } },
            },
          },
        },
      },
    });
    if (!seller) throw new NotFoundException('Store not found');
    const { _count, ...rest } = seller;
    return { ...rest, productCount: _count.products };
  }
}
