import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { paginate, type Paginated } from '../common/dto/pagination.dto';
import { decimal, money } from '../common/utils/money.util';
import type { ProductQueryDto, ReviewDto } from './dto/product.dto';

const productCardSelect = {
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
  category: { select: { id: true, name: true, slug: true } },
  seller: {
    select: { id: true, storeName: true, storeSlug: true, logoUrl: true },
  },
  _count: { select: { reviews: true } },
} as const;

type ProductCard = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ProductQueryDto): Promise<Paginated<ReturnType<typeof mapCard>>> {
    const where = await this.buildWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    if (query.sort === 'popular') {
      const candidateIds = await this.prisma.product.findMany({
        where,
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });
      const sales = await this.salesMap(candidateIds.map((product) => product.id));
      const ordered = candidateIds
        .map((product) => ({
          id: product.id,
          createdAt: product.createdAt,
          sold: sales.get(product.id) ?? 0,
        }))
        .sort(
          (a, b) =>
            b.sold - a.sold || b.createdAt.getTime() - a.createdAt.getTime(),
        );
      const pageIds = ordered
        .slice(skip, skip + query.pageSize)
        .map((item) => item.id);
      const products = await this.prisma.product.findMany({
        where: { id: { in: pageIds } },
        select: productCardSelect,
      });
      const order = new Map(pageIds.map((id, index) => [id, index]));
      products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      return paginate(
        products.map(mapCard),
        ordered.length,
        query.page,
        query.pageSize,
      );
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sort === 'price_asc'
        ? { price: 'asc' }
        : query.sort === 'price_desc'
          ? { price: 'desc' }
          : { createdAt: 'desc' };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: productCardSelect,
        orderBy,
        skip,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(products.map(mapCard), total, query.page, query.pageSize);
  }

  async getById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] },
        seller: { approvalStatus: 'APPROVED' },
      },
      select: {
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
        category: {
          select: { id: true, name: true, slug: true, description: true },
        },
        seller: {
          select: {
            id: true,
            storeName: true,
            storeSlug: true,
            logoUrl: true,
            description: true,
            approvalStatus: true,
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            rating: true,
            title: true,
            comment: true,
            createdAt: true,
            customer: { select: { name: true } },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const [ratingAgg, sold] = await Promise.all([
      this.prisma.productReview.aggregate({
        where: { productId: id },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.orderItem.aggregate({
        where: {
          productId: id,
          sellerOrder: {
            status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
          },
        },
        _sum: { quantity: true },
      }),
    ]);

    const available = Math.max(0, product.stockOnHand - product.reservedStock);
    return {
      ...product,
      price: money(product.price),
      compareAtPrice: product.compareAtPrice
        ? money(product.compareAtPrice)
        : null,
      stockOnHand: undefined,
      reservedStock: undefined,
      available,
      lowStock: available > 0 && available <= 5,
      rating: ratingAgg._avg.rating ? Number(ratingAgg._avg.rating.toFixed(2)) : null,
      reviewCount: ratingAgg._count._all,
      soldCount: sold._sum.quantity ?? 0,
    };
  }

  async listReviews(productId: string, page: number, pageSize: number) {
    const where = { productId };
    const [reviews, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          rating: true,
          title: true,
          comment: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      }),
      this.prisma.productReview.count({ where }),
    ]);
    return paginate(reviews, total, page, pageSize);
  }

  async createReview(productId: string, customerId: string, dto: ReviewDto) {
    const orderItem = await this.prisma.orderItem.findFirst({
      where: {
        id: dto.orderItemId,
        productId,
        sellerOrder: {
          status: 'DELIVERED',
          order: { customerId },
        },
      },
      select: { id: true },
    });
    if (!orderItem) {
      throw new ForbiddenException(
        'Only delivered purchases from your own orders can be reviewed',
      );
    }
    const existing = await this.prisma.productReview.findUnique({
      where: { orderItemId: orderItem.id },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('This purchase has already been reviewed');
    }
    const review = await this.prisma.productReview.create({
      data: {
        productId,
        customerId,
        orderItemId: orderItem.id,
        rating: dto.rating,
        title: dto.title?.trim() || null,
        comment: dto.comment?.trim() || null,
      },
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        createdAt: true,
      },
    });
    return { review };
  }

  private async buildWhere(query: ProductQueryDto): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = {
      status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] },
      seller: { approvalStatus: 'APPROVED' },
      category: { isActive: true },
    };

    if (query.q?.trim()) {
      const term = query.q.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { brand: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.category) {
      const category = await this.prisma.category.findFirst({
        where: {
          OR: [{ id: query.category }, { slug: query.category }],
        },
        select: { id: true },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
      const children = await this.prisma.category.findMany({
        where: { parentId: category.id, isActive: true },
        select: { id: true },
      });
      where.categoryId = {
        in: [category.id, ...children.map((child) => child.id)],
      };
    }

    if (query.seller) {
      const seller = await this.prisma.sellerProfile.findFirst({
        where: {
          OR: [{ id: query.seller }, { storeSlug: query.seller }],
          approvalStatus: 'APPROVED',
        },
        select: { id: true },
      });
      if (!seller) throw new NotFoundException('Seller not found');
      where.sellerId = seller.id;
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      if (
        query.minPrice !== undefined &&
        query.maxPrice !== undefined &&
        query.minPrice > query.maxPrice
      ) {
        throw new BadRequestException('minPrice cannot be greater than maxPrice');
      }
      where.price = {
        ...(query.minPrice !== undefined
          ? { gte: decimal(query.minPrice) }
          : {}),
        ...(query.maxPrice !== undefined
          ? { lte: decimal(query.maxPrice) }
          : {}),
      };
    }

    if (query.inStock) {
      // Field-to-field comparison: stockOnHand > reservedStock.
      where.stockOnHand = { gt: this.prisma.product.fields.reservedStock };
    }

    return where;
  }

  private async salesMap(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();
    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        sellerOrder: {
          status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        },
      },
      _sum: { quantity: true },
    });
    return new Map(
      grouped.map((row) => [row.productId, row._sum.quantity ?? 0]),
    );
  }
}

function mapCard(product: ProductCard) {
  const available = Math.max(0, product.stockOnHand - product.reservedStock);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    brand: product.brand,
    sku: product.sku,
    price: money(product.price),
    compareAtPrice: product.compareAtPrice ? money(product.compareAtPrice) : null,
    imageUrl: product.imageUrl,
    status: product.status,
    available,
    lowStock: available > 0 && available <= 5,
    reviewCount: product._count.reviews,
    category: product.category,
    seller: product.seller,
    createdAt: product.createdAt,
  };
}
