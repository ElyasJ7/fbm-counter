import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  roleHasPermission,
  type DocumentCategory,
} from '@fbm/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError, apiDownload } from '../lib/api';
import { formatDateDe, formatFileSize } from '../lib/format';
import {
  deleteDocument,
  documentDownloadPath,
  fetchDocuments,
  uploadDocument,
} from '../services/documents';
import { fetchProjects } from '../services/projects';

type DocumentsPageProps = {
  embeddedProjectId?: string;
  compact?: boolean;
};

type UploadFormState = {
  title: string;
  category: DocumentCategory;
  description: string;
  projectId: string;
  file: File | null;
};

const emptyForm: UploadFormState = {
  title: '',
  category: 'OTHER',
  description: '',
  projectId: '',
  file: null,
};

async function triggerDownload(id: string, fileName: string) {
  const response = await apiDownload(documentDownloadPath(id));
  if (!response.ok) {
    throw new Error('Download failed');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function DocumentsPage({
  embeddedProjectId,
  compact = false,
}: DocumentsPageProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const canWrite = user
    ? roleHasPermission(user.role, 'documents:write')
    : false;

  const projectFilter =
    embeddedProjectId ?? searchParams.get('projectId') ?? '';
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [category, setCategory] = useState<DocumentCategory | ''>('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<UploadFormState>({
    ...emptyForm,
    projectId: projectFilter,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['documents', page, search, category, projectFilter],
    queryFn: () =>
      fetchDocuments({
        page,
        pageSize: compact ? 10 : 20,
        search,
        category,
        projectId: projectFilter || undefined,
      }),
  });

  const projectsQuery = useQuery({
    queryKey: ['projects', 'document-form'],
    queryFn: () => fetchProjects({ page: 1, pageSize: 100 }),
    enabled: showForm && !embeddedProjectId,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!form.file) {
        throw new Error('Please choose a file');
      }
      return uploadDocument({
        file: form.file,
        title: form.title.trim() || undefined,
        category: form.category,
        description: form.description.trim() || undefined,
        projectId: form.projectId || projectFilter || undefined,
      });
    },
    onSuccess: async () => {
      setShowForm(false);
      setForm({ ...emptyForm, projectId: projectFilter });
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Upload failed',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const categoryOptions = useMemo(
    () =>
      DOCUMENT_CATEGORIES.map((value) => ({
        value,
        label: DOCUMENT_CATEGORY_LABELS[value],
      })),
    [],
  );

  const projectOptions = useMemo(
    () =>
      (projectsQuery.data?.data ?? []).map((project) => ({
        value: project.id,
        label: `${project.projectNumber} — ${project.name}`,
      })),
    [projectsQuery.data],
  );

  return (
    <div>
      {!compact ? (
        <PageHeader
          title="Dokumente"
          description="Projektdokumente sicher hochladen, finden und herunterladen."
          actions={
            canWrite ? (
              <Button
                onClick={() => {
                  setForm({ ...emptyForm, projectId: projectFilter });
                  setShowForm(true);
                  setFormError(null);
                }}
              >
                Dokument hochladen
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            Dokumente
          </h2>
          {canWrite ? (
            <Button
              size="sm"
              onClick={() => {
                setForm({ ...emptyForm, projectId: projectFilter });
                setShowForm(true);
                setFormError(null);
              }}
            >
              Hochladen
            </Button>
          ) : null}
        </div>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <Input
          label="Suche"
          name="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Dateiname, Titel…"
        />
        <Select
          label="Kategorie"
          name="category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as DocumentCategory | '');
            setPage(1);
          }}
          options={categoryOptions}
          placeholder="Alle Kategorien"
        />
      </div>

      {showForm ? (
        <Card title="Dokument hochladen" className="mb-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Titel (optional)"
              name="title"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <Select
              label="Kategorie"
              name="category"
              value={form.category}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  category: e.target.value as DocumentCategory,
                }))
              }
              options={categoryOptions}
            />
            {!embeddedProjectId ? (
              <Select
                label="Projekt (optional)"
                name="projectId"
                value={form.projectId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, projectId: e.target.value }))
                }
                options={projectOptions}
                placeholder="Kein Projekt"
              />
            ) : null}
            <label className="flex w-full flex-col gap-1.5 text-sm md:col-span-2">
              <span className="font-medium text-[var(--color-ink)]">Datei</span>
              <input
                type="file"
                name="file"
                className="block w-full text-sm text-[var(--color-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-surface-2)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--color-ink)]"
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    file: e.target.files?.[0] ?? null,
                  }))
                }
              />
            </label>
            <div className="md:col-span-2">
              <Input
                label="Beschreibung (optional)"
                name="description"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
          </div>
          {formError ? (
            <p className="mt-3 text-sm text-[var(--color-danger)]" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !form.file}
            >
              {uploadMutation.isPending ? 'Wird hochgeladen…' : 'Hochladen'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
            >
              Abbrechen
            </Button>
          </div>
        </Card>
      ) : null}

      {query.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : query.isError ? (
        <EmptyState
          title="Dokumente konnten nicht geladen werden"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Bitte später erneut versuchen.'
          }
        />
      ) : (query.data?.data.length ?? 0) === 0 ? (
        <EmptyState
          title="Keine Dokumente"
          description="Laden Sie Verträge, Pläne oder Belege hoch."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Dokument</th>
                  <th className="px-3 py-2 font-medium">Kategorie</th>
                  {!embeddedProjectId ? (
                    <th className="px-3 py-2 font-medium">Projekt</th>
                  ) : null}
                  <th className="px-3 py-2 font-medium">Größe</th>
                  <th className="px-3 py-2 font-medium">Hochgeladen</th>
                  <th className="px-3 py-2 font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.data.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-3 py-3">
                      <div className="font-medium text-[var(--color-ink)]">
                        {doc.title || doc.originalFileName}
                      </div>
                      {doc.title ? (
                        <div className="text-xs text-[var(--color-muted)]">
                          {doc.originalFileName}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {DOCUMENT_CATEGORY_LABELS[doc.category]}
                    </td>
                    {!embeddedProjectId ? (
                      <td className="px-3 py-3">
                        {doc.project ? (
                          <Link
                            to={`/projects/${doc.project.id}?tab=documents`}
                            className="text-[var(--color-accent)] hover:underline"
                          >
                            {doc.project.projectNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-3">{formatFileSize(doc.sizeBytes)}</td>
                    <td className="px-3 py-3">
                      <div>{formatDateDe(doc.createdAt)}</div>
                      <div className="text-xs text-[var(--color-muted)]">
                        {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void triggerDownload(doc.id, doc.originalFileName)
                          }
                        >
                          Download
                        </Button>
                        {canWrite ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Dokument „${doc.title || doc.originalFileName}“ löschen?`,
                                )
                              ) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                          >
                            Löschen
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(query.data?.meta.totalPages ?? 1) > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Zurück
              </Button>
              <span className="text-sm text-[var(--color-muted)]">
                Seite {query.data?.meta.page} von {query.data?.meta.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= (query.data?.meta.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Weiter
              </Button>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
