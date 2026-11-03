import { paginate } from '../../src/common/dto/pagination.dto';

describe('paginate', () => {
  it('builds metadata for the first page', () => {
    const result = paginate(['a', 'b'], 25, 1, 10);
    expect(result).toEqual({
      items: ['a', 'b'],
      meta: { page: 1, pageSize: 10, total: 25, totalPages: 3 },
    });
  });

  it('always reports at least one page, even when empty', () => {
    expect(paginate([], 0, 1, 12).meta.totalPages).toBe(1);
  });

  it('rounds partial pages up', () => {
    expect(paginate([], 21, 3, 10).meta.totalPages).toBe(3);
    expect(paginate([], 1, 1, 10).meta.totalPages).toBe(1);
    expect(paginate([], 10, 1, 10).meta.totalPages).toBe(1);
    expect(paginate([], 11, 1, 10).meta.totalPages).toBe(2);
  });

  it('preserves the requested page and page size', () => {
    const { meta } = paginate([], 100, 4, 15);
    expect(meta.page).toBe(4);
    expect(meta.pageSize).toBe(15);
  });
});
