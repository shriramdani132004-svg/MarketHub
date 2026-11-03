import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  addMoney,
  money,
  shippingForSubtotal,
  ZERO,
} from '../common/utils/money.util';
import type { Prisma } from '../generated/prisma/client';

const cartInclude = {
  items: {
    orderBy: { addedAt: 'asc' },
    include: {
      product: {
        include: {
          seller: {
            select: {
              id: true,
              storeName: true,
              storeSlug: true,
              approvalStatus: true,
              logoUrl: true,
            },
          },
          category: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export type CartItemView = ReturnType<typeof mapCartItem>;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(customerId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { customerId, status: 'ACTIVE' },
      include: cartInclude,
    });
    return this.present(cart);
  }

  async addItem(customerId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        seller: { select: { approvalStatus: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (!['PUBLISHED', 'OUT_OF_STOCK'].includes(product.status)) {
      throw new BadRequestException('This product is not available for purchase');
    }
    if (product.seller.approvalStatus !== 'APPROVED') {
      throw new BadRequestException('This seller is not currently accepting orders');
    }
    const available = product.stockOnHand - product.reservedStock;
    if (available < 1) {
      throw new ConflictException('This product is out of stock');
    }

    const cart = await this.getOrCreateActiveCart(customerId);
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > available) {
      throw new ConflictException(
        `Only ${available} unit${available === 1 ? '' : 's'} are currently available`,
      );
    }
    if (nextQuantity > 99) {
      throw new BadRequestException('Maximum quantity per product is 99');
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity },
      });
    }
    return this.getCart(customerId);
  }

  async updateItem(customerId: string, itemId: string, quantity: number) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { customerId, status: 'ACTIVE' } },
      include: {
        product: { include: { seller: { select: { approvalStatus: true } } } },
      },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    if (
      !['PUBLISHED', 'OUT_OF_STOCK'].includes(item.product.status) ||
      item.product.seller.approvalStatus !== 'APPROVED'
    ) {
      throw new BadRequestException('This product is no longer available');
    }
    const available = item.product.stockOnHand - item.product.reservedStock;
    if (quantity > available) {
      throw new ConflictException(
        `Only ${Math.max(0, available)} unit${available === 1 ? '' : 's'} are currently available`,
      );
    }
    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });
    return this.getCart(customerId);
  }

  async removeItem(customerId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { customerId, status: 'ACTIVE' } },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getCart(customerId);
  }

  async clear(customerId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { customerId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return this.getCart(customerId);
  }

  async getOrCreateActiveCart(customerId: string) {
    const existing = await this.prisma.cart.findFirst({
      where: { customerId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (existing) return existing;
    try {
      return await this.prisma.cart.create({
        data: { customerId, status: 'ACTIVE' },
        select: { id: true },
      });
    } catch (error) {
      // Concurrent add-to-cart can race the partial unique index; reuse the winner.
      const winner = await this.prisma.cart.findFirst({
        where: { customerId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (winner) return winner;
      throw error;
    }
  }

  present(cart: CartWithItems | null) {
    if (!cart) {
      return {
        id: null,
        items: [] as CartItemView[],
        itemCount: 0,
        subtotal: '0.00',
        shippingEstimate: '0.00',
        grandTotal: '0.00',
        hasIssues: false,
      };
    }
    const items = cart.items.map(mapCartItem);
    const validItems = items.filter((item) => !item.issue);
    const subtotal = addMoney(...validItems.map((item) => item.lineTotalDecimal));
    const sellerSubtotals = new Map<string, Prisma.Decimal>();
    for (const item of validItems) {
      const key = item.product.seller.id;
      sellerSubtotals.set(
        key,
        (sellerSubtotals.get(key) ?? ZERO).plus(item.lineTotalDecimal),
      );
    }
    let shipping = ZERO;
    for (const sellerSubtotal of sellerSubtotals.values()) {
      shipping = shipping.plus(shippingForSubtotal(sellerSubtotal));
    }
    return {
      id: cart.id,
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: money(subtotal),
      shippingEstimate: money(shipping),
      grandTotal: money(subtotal.plus(shipping)),
      hasIssues: items.some((item) => Boolean(item.issue)),
    };
  }
}

function mapCartItem(item: CartWithItems['items'][number]) {
  const product = item.product;
  const available = Math.max(0, product.stockOnHand - product.reservedStock);
  let issue: string | null = null;
  if (product.status === 'ARCHIVED') issue = 'This product has been archived';
  else if (product.status === 'DRAFT') issue = 'This product is not published';
  else if (product.seller.approvalStatus !== 'APPROVED')
    issue = 'This seller is not currently accepting orders';
  else if (available < item.quantity)
    issue =
      available === 0
        ? 'Out of stock'
        : `Only ${available} unit${available === 1 ? '' : 's'} available`;
  else if (available === 0) issue = 'Out of stock';

  const lineTotal = product.price.mul(item.quantity);
  return {
    id: item.id,
    quantity: item.quantity,
    quantityLimit: Math.min(99, available),
    available,
    unitPrice: money(product.price),
    lineTotal: money(lineTotal),
    lineTotalDecimal: lineTotal,
    issue,
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: product.imageUrl,
      price: money(product.price),
      status: product.status,
      seller: {
        id: product.seller.id,
        storeName: product.seller.storeName,
        storeSlug: product.seller.storeSlug,
        logoUrl: product.seller.logoUrl,
      },
      category: product.category,
    },
  };
}
