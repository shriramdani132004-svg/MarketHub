'use client';

import { useMemo, useState } from 'react';
import {
  FolderTree,
  Layers,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useApiData } from '../../../lib/useApi';
import { api, errorMessage } from '../../../lib/api';
import type { AdminCategory } from '../../../lib/types';
import { formatDateTime } from '../../../lib/format';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/toast';

interface CategoryForm {
  name: string;
  slug: string;
  description: string;
  parentId: string;
  isActive: boolean;
}

const EMPTY: CategoryForm = {
  name: '',
  slug: '',
  description: '',
  parentId: '',
  isActive: true,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export default function AdminCategoriesPage() {
  const toast = useToast();
  const categories = useApiData<{ items: AdminCategory[] }>('/admin/categories');
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CategoryForm>({ ...EMPTY });
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => categories.data?.items ?? [], [categories.data]);

  const grouped = useMemo(() => {
    const roots = items.filter((item) => !item.parentId);
    return roots.map((root) => ({
      root,
      children: items.filter((item) => item.parentId === root.id),
    }));
  }, [items]);

  const orphans = useMemo(
    () =>
      items.filter(
        (item) => item.parentId && !items.some((candidate) => candidate.id === item.parentId),
      ),
    [items],
  );

  function startCreate() {
    setForm({ ...EMPTY });
    setEditing(null);
    setCreating(true);
    setError(null);
  }

  function startEdit(category: AdminCategory) {
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      parentId: category.parentId ?? '',
      isActive: category.isActive,
    });
    setEditing(category);
    setCreating(false);
    setError(null);
  }

  function close() {
    setCreating(false);
    setEditing(null);
    setError(null);
  }

  function update<K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
        parentId: form.parentId || undefined,
        isActive: form.isActive,
      };
      if (editing) {
        await api(`/admin/categories/${editing.id}`, { method: 'PATCH', body });
        toast.success(`${form.name.trim()} updated.`);
      } else {
        await api('/admin/categories', { method: 'POST', body });
        toast.success(`${form.name.trim()} created.`);
      }
      close();
      categories.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(category: AdminCategory) {
    try {
      await api(`/admin/categories/${category.id}`, {
        method: 'PATCH',
        body: { isActive: !category.isActive },
      });
      toast.success(
        `${category.name} ${category.isActive ? 'deactivated' : 'reactivated'}.`,
      );
      categories.reload();
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/admin/categories/${deleting.id}`, { method: 'DELETE' });
      toast.success(`${deleting.name} deleted.`);
      setDeleting(null);
      categories.reload();
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const parentOptions = items.filter(
    (item) => !item.parentId && item.id !== editing?.id,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">Catalogue</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">Categories</h1>
          <p className="mt-1 text-sm text-slate-500">
            Control the marketplace taxonomy. Inactive categories disappear from the storefront.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => categories.reload()}
          >
            Refresh
          </Button>
          <Button size="sm" onClick={startCreate} icon={<Plus className="h-4 w-4" />}>
            New category
          </Button>
        </div>
      </div>

      {categories.error ? (
        <ErrorState message={categories.error} onRetry={categories.reload} />
      ) : categories.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="h-5 w-5" />}
          title="No categories yet"
          description="Create the first top-level category so sellers can list products."
          action={<Button onClick={startCreate}>Create category</Button>}
        />
      ) : (
        <div className="space-y-3">
          {grouped.map(({ root, children }) => (
            <section key={root.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Layers className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-navy">{root.name}</p>
                      <Badge tone={root.isActive ? 'teal' : 'slate'}>
                        {root.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {root._count.children > 0 ? (
                        <Badge tone="violet">{root._count.children} sub</Badge>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      /{root.slug} · {root._count.products} product
                      {root._count.products === 1 ? '' : 's'}
                      {root.description ? ` · ${root.description}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Power className="h-3.5 w-3.5" />}
                    onClick={() => toggleActive(root)}
                  >
                    {root.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => startEdit(root)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-600 hover:bg-rose-50"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setDeleting(root)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              {children.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {children.map((child) => (
                    <li
                      key={child.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 pl-16"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">{child.name}</p>
                          <Badge tone={child.isActive ? 'teal' : 'slate'}>
                            {child.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          /{child.slug} · {child._count.products} product
                          {child._count.products === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(child)}>
                          {child.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(child)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-50"
                          onClick={() => setDeleting(child)}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          {orphans.length > 0 ? (
            <section className="card p-5">
              <h2 className="text-sm font-bold text-navy">Unassigned sub-categories</h2>
              <ul className="mt-2 divide-y divide-slate-100">
                {orphans.map((category) => (
                  <li key={category.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{category.name}</p>
                      <p className="text-[11px] text-slate-500">
                        missing parent · /{category.slug}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(category)}>
                      Fix
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="text-[11px] text-slate-500">
            Created categories appear immediately. Deactivate a category instead of deleting it when
            products or sub-categories still reference it.
          </p>
        </div>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          if (busy) return;
          close();
        }}
        title={editing ? 'Edit category' : 'New category'}
        description="Slugs are used in storefront URLs and must be unique."
        size="lg"
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={() => {
                const formEl = document.getElementById('category-form') as HTMLFormElement | null;
                formEl?.requestSubmit();
              }}
            >
              {editing ? 'Save changes' : 'Create category'}
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required>
              <Input
                value={form.name}
                onChange={(event) => {
                  const value = event.target.value;
                  update('name', value);
                  if (!editing) update('slug', slugify(value));
                }}
                required
                minLength={2}
                maxLength={80}
                placeholder="Audio"
              />
            </Field>
            <Field label="Slug" required hint="Lowercase letters, numbers and hyphens.">
              <Input
                value={form.slug}
                onChange={(event) => update('slug', slugify(event.target.value))}
                required
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                maxLength={80}
                placeholder="audio"
              />
            </Field>
          </div>
          <Field label="Parent category" hint="Leave empty for a top-level category.">
            <Select
              value={form.parentId}
              onChange={(event) => update('parentId', event.target.value)}
            >
              <option value="">Top-level category</option>
              {parentOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" hint="Optional. Shown on category pages.">
            <Textarea
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              maxLength={1000}
              placeholder="Headphones, speakers and studio accessories."
            />
          </Field>
          <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={form.isActive}
              onChange={(event) => update('isActive', event.target.checked)}
            />
            Active and visible on the storefront
          </label>
          {editing ? (
            <p className="text-[11px] text-slate-500">
              Created {formatDateTime(editing.createdAt)} · {editing._count.products} product
              {editing._count.products === 1 ? '' : 's'} · {editing._count.children} sub-categor
              {editing._count.children === 1 ? 'y' : 'ies'}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this category?"
        description={
          deleting
            ? `${deleting.name} can only be deleted when it has no products or sub-categories. Otherwise deactivate it instead.`
            : ''
        }
        confirmLabel="Delete category"
        loading={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
