import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SellersService } from '../sellers/sellers.service';
import { decimal, money } from '../common/utils/money.util';
import { safeImageUrl, slugify } from '../common/utils/crypto.util';
import { paginate } from '../common/dto/pagination.dto';
import type {
  CreateProductDto,
  InventoryDto,
  SellerProductQueryDto,
  UpdateProductDto,
} from './dto/seller.dto';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['DRAFT', 'OUT_OF_STOCK', 'ARCHIVED'],
  OUT_OF_STOCK: ['PUBLISHED', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

const sellerProductSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  brand: true,
  sku: true,
  price: true,
  compareAtPrice: true,
  stockOnHand: true,
  reservedStock: true,
  imageUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { orderItems: true } },
} as const;

@Injectable()
export class SellerProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellersService: SellersService,
  ) {}

  async list(userId: string, query: SellerProductQueryDto) {
    const seller = await this.sellersService.getOwnProfile(userId);
    const where: Prisma.ProductWhereInput = { sellerId: seller.id };
    if (query.q?.trim()) {
      const term = query.q.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { brand: { contains: term, mode: 'insensitive' } },
      ];
    }
    if (query.status) where.status = query.status;

    if (query.lowStock) {
      const all = await this.prisma.product.findMany({
        where,
        select: sellerProductSelect,
        orderBy: { updatedAt: 'desc' },
      });
      const low = all.filter((product) => {
        const available = product.stockOnHand - product.reservedStock;
        return available > 0 && available <= 5;
      });
      const start = (query.page - 1) * query.pageSize;
      return paginate(
        low.slice(start, start + query.pageSize).map(mapSellerProduct),
        low.length,
        query.page,
        query.pageSize,
      );
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: sellerProductSelect,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(items.map(mapSellerProduct), total, query.page, query.pageSize);
  }

  async getOne(userId: string, id: string) {
    const seller = await this.sellersService.getOwnProfile(userId);
    const product = await this.prisma.product.findFirst({
      where: { id, sellerId: seller.id },
      select: sellerProductSelect,
    });
    if (!product) throw new NotFoundException('Product not found');
    return mapSellerProduct(product);
  }

  async create(userId: string, dto: CreateProductDto) {
    const seller = await this.sellersService.requireApprovedSeller(userId);
    await this.requireActiveCategory(dto.categoryId);

    const price = decimal(dto.price);
    if (!price.greaterThan(0)) {
      throw new BadRequestException('Price must be greater than zero');
    }
    const compareAtPrice = dto.compareAtPrice ? decimal(dto.compareAtPrice) : null;
    if (compareAtPrice && compareAtPrice.lessThan(price)) {
      throw new BadRequestException('compareAtPrice cannot be below the selling price');
    }
    const stockOnHand = dto.stockOnHand ?? 0;
    if (dto.status === 'PUBLISHED' && stockOnHand < 1) {
      throw new BadRequestException('A product needs stock before it can be published');
    }
    const imageUrl = dto.imageUrl ? safeImageUrl(dto.imageUrl) : null;
    if (dto.imageUrl && !imageUrl) {
      throw new BadRequestException('imageUrl must be a valid http(s) URL');
    }
    const sku = dto.sku.trim().toUpperCase();
    const existingSku = await this.prisma.product.findFirst({
      where: { sellerId: seller.id, sku },
      select: { id: true },
    });
    if (existingSku) {
      throw new ConflictException('You already have a product with this SKU');
    }
    const slug = await this.uniqueSlug(seller.id, slugify(dto.name));

    const created = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sellerId: seller.id,
          categoryId: dto.categoryId,
          name: dto.name.trim(),
          slug,
          description: dto.description.trim(),
          brand: dto.brand?.trim() || null,
          sku,
          price,
          compareAtPrice,
          stockOnHand,
          reservedStock: 0,
          imageUrl,
          status: dto.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        },
        select: sellerProductSelect,
      });
      if (stockOnHand > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            sellerId: seller.id,
            movementType: 'STOCK_ADDED',
            quantity: stockOnHand,
            reference: 'Initial stock',
            metadata: { stockOnHand },
          },
        });
      }
      return product;
    });

    return mapSellerProduct(created);
  }

  async update(userId: string, id: string, dto: UpdateProductDto) {
    const seller = await this.sellersService.requireApprovedSeller(userId);
    const product = await this.requireOwnedProduct(seller.id, id);

    if (dto.categoryId) await this.requireActiveCategory(dto.categoryId);

    const price = dto.price !== undefined ? decimal(dto.price) : product.price;
    if (!price.greaterThan(0)) {
      throw new BadRequestException('Price must be greater than zero');
    }
    const compareAtPrice =
      dto.compareAtPrice !== undefined
        ? decimal(dto.compareAtPrice)
        : product.compareAtPrice;
    if (compareAtPrice && compareAtPrice.lessThan(price)) {
      throw new BadRequestException('compareAtPrice cannot be below the selling price');
    }

    if (dto.status && dto.status !== product.status) {
      const allowed = STATUS_TRANSITIONS[product.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot move a product from ${product.status} to ${dto.status}`,
        );
      }
      if (dto.status === 'PUBLISHED') {
        const available = product.stockOnHand - product.reservedStock;
        if (available < 1) {
          throw new BadRequestException(
            'A product needs available stock before it can be published',
          );
        }
      }
    }

    if (dto.sku && dto.sku.trim().toUpperCase() !== product.sku) {
      const sku = dto.sku.trim().toUpperCase();
      const duplicate = await this.prisma.product.findFirst({
        where: { sellerId: seller.id, sku, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException('You already have a product with this SKU');
      }
    }

    let imageUrl: string | null | undefined;
    if (dto.imageUrl !== undefined) {
      if (!dto.imageUrl) {
        imageUrl = null;
      } else {
        imageUrl = safeImageUrl(dto.imageUrl);
        if (!imageUrl) {
          throw new BadRequestException('imageUrl must be a valid http(s) URL');
        }
      }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand?.trim() || null } : {}),
        ...(dto.sku !== undefined ? { sku: dto.sku.trim().toUpperCase() } : {}),
        ...(dto.price !== undefined ? { price } : {}),
        ...(dto.compareAtPrice !== undefined ? { compareAtPrice } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      select: sellerProductSelect,
    });
    return mapSellerProduct(updated);
  }

  async archive(userId: string, id: string) {
    const seller = await this.sellersService.requireApprovedSeller(userId);
    const product = await this.requireOwnedProduct(seller.id, id);
    if (product.status === 'ARCHIVED') {
      return { success: true, alreadyArchived: true };
    }
    await this.prisma.product.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
    return { success: true };
  }

  async adjustInventory(userId: string, id: string, dto: InventoryDto) {
    const seller = await this.sellersService.requireApprovedSeller(userId);
    const product = await this.requireOwnedProduct(seller.id, id);

    if (dto.stockOnHand < product.reservedStock) {
      throw new ConflictException(
        `Stock cannot be below the ${product.reservedStock} units reserved by pending orders`,
      );
    }
    const delta = dto.stockOnHand - product.stockOnHand;
    if (delta === 0) return { success: true, unchanged: true };

    let nextStatus = product.status;
    const nextAvailable = dto.stockOnHand - product.reservedStock;
    if (nextAvailable <= 0 && product.status === 'PUBLISHED') {
      nextStatus = 'OUT_OF_STOCK';
    } else if (nextAvailable > 0 && product.status === 'OUT_OF_STOCK') {
      nextStatus = 'PUBLISHED';
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.product.updateMany({
        where: {
          id,
          sellerId: seller.id,
          stockOnHand: product.stockOnHand,
          reservedStock: product.reservedStock,
        },
        data: { stockOnHand: dto.stockOnHand, status: nextStatus },
      });
      if (changed.count === 0) {
        throw new ConflictException(
          'Inventory changed concurrently. Refresh and try again.',
        );
      }
      await tx.inventoryMovement.create({
        data: {
          productId: id,
          sellerId: seller.id,
          movementType: 'ADJUSTMENT',
          quantity: Math.abs(delta),
          reference: dto.reason?.trim() || (delta > 0 ? 'Stock increase' : 'Stock decrease'),
          metadata: {
            previousStock: product.stockOnHand,
            nextStock: dto.stockOnHand,
            delta,
          },
        },
      });
      return tx.product.findUniqueOrThrow({
        where: { id },
        select: sellerProductSelect,
      });
    });

    return mapSellerProduct(updated);
  }

  private async requireOwnedProduct(sellerId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, sellerId },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async requireActiveCategory(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('Select an active category');
  }

  private async uniqueSlug(sellerId: string, base: string): Promise<string> {
    let candidate = base;
    let suffix = 2;
    while (suffix < 50) {
      const existing = await this.prisma.product.findFirst({
        where: { sellerId, slug: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}

function mapSellerProduct(product: {
  price: Prisma.Decimal;
  compareAtPrice: Prisma.Decimal | null;
  stockOnHand: number;
  reservedStock: number;
  _count?: { orderItems: number };
  [key: string]: unknown;
}) {
  const available = Math.max(0, product.stockOnHand - product.reservedStock);
  return {
    ...product,
    price: money(product.price),
    compareAtPrice: product.compareAtPrice ? money(product.compareAtPrice) : null,
    available,
    lowStock: available > 0 && available <= 5,
    orderItemCount: product._count?.orderItems ?? 0,
  };
}
