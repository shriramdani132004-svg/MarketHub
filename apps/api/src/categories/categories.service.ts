import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { CategoryDto, UpdateCategoryDto } from './dto/category.dto';

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  parentId: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: {
        ...categorySelect,
        _count: {
          select: {
            products: {
              where: {
                status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] },
                seller: { approvalStatus: 'APPROVED' },
              },
            },
          },
        },
      },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });

    const items = categories.map((category) => ({
      ...category,
      productCount: category._count.products,
      _count: undefined,
    }));

    return { items, tree: buildTree(items) };
  }

  async listAdmin() {
    const categories = await this.prisma.category.findMany({
      select: {
        ...categorySelect,
        _count: { select: { products: true, children: true } },
      },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
    return { items: categories };
  }

  async getBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      select: {
        ...categorySelect,
        children: {
          where: { isActive: true },
          select: { id: true, name: true, slug: true },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: {
            products: {
              where: {
                status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] },
                seller: { approvalStatus: 'APPROVED' },
              },
            },
          },
        },
      },
    });
    if (!category || !category.isActive) {
      throw new NotFoundException('Category not found');
    }
    const { _count, ...rest } = category;
    return { ...rest, productCount: _count.products };
  }

  async create(dto: CategoryDto) {
    if (dto.parentId) await this.requireCategory(dto.parentId);
    const exists = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (exists) throw new ConflictException('A category with this slug already exists');
    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug.trim(),
        description: dto.description?.trim() || null,
        parentId: dto.parentId || null,
        isActive: dto.isActive ?? true,
      },
      select: categorySelect,
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.requireCategory(id);
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      await this.requireCategory(dto.parentId);
    }
    if (dto.slug && dto.slug !== category.slug) {
      const exists = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
        select: { id: true },
      });
      if (exists) {
        throw new ConflictException('A category with this slug already exists');
      }
    }
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: categorySelect,
    });
  }

  async remove(id: string) {
    await this.requireCategory(id);
    const [products, children] = await Promise.all([
      this.prisma.product.count({ where: { categoryId: id } }),
      this.prisma.category.count({ where: { parentId: id } }),
    ]);
    if (products > 0 || children > 0) {
      throw new ConflictException(
        'Category still has products or sub-categories. Deactivate it instead.',
      );
    }
    await this.prisma.category.delete({ where: { id } });
    return { success: true };
  }

  private async requireCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }
}

interface FlatCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  createdAt: Date;
  productCount: number;
}

function buildTree(items: FlatCategory[]) {
  const byId = new Map(items.map((item) => [item.id, { ...item, children: [] as unknown[] }]));
  const roots: unknown[] = [];
  for (const item of byId.values()) {
    if (item.parentId && byId.has(item.parentId)) {
      (byId.get(item.parentId)!.children as unknown[]).push(item);
    } else if (!item.parentId) {
      roots.push(item);
    }
  }
  return roots;
}
