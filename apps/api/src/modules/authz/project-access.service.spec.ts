import { ProjectAccessService } from './project-access.service';

describe('ProjectAccessService', () => {
  const pm: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'PROJECT_MANAGER';
  } = {
    id: 'pm-1',
    email: 'pm@example.com',
    firstName: 'Pat',
    lastName: 'Manager',
    role: 'PROJECT_MANAGER',
  };
  const admin: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'ADMIN';
  } = {
    id: 'admin-1',
    email: 'admin@example.com',
    firstName: 'Ada',
    lastName: 'Admin',
    role: 'ADMIN',
  };
  const viewer: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'VIEWER';
  } = {
    id: 'viewer-1',
    email: 'viewer@example.com',
    firstName: 'Vic',
    lastName: 'Viewer',
    role: 'VIEWER',
  };

  it('treats ADMIN and VIEWER as company-wide; PM as scoped', () => {
    const service = new ProjectAccessService({} as never);
    expect(service.isCompanyWide(admin.role)).toBe(true);
    expect(service.isCompanyWide(viewer.role)).toBe(true);
    expect(service.isScoped(pm.role)).toBe(true);
    expect(service.projectWhere(pm)).toEqual({ projectManagerId: 'pm-1' });
    expect(service.projectWhere(admin)).toEqual({});
  });

  it('allows assigned PM and denies unassigned project access', async () => {
    const prisma = {
      project: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'p-assigned',
            projectManagerId: 'pm-1',
          })
          .mockResolvedValueOnce({
            id: 'p-other',
            projectManagerId: 'other-pm',
          })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'p-other',
            projectManagerId: 'other-pm',
          }),
      },
    };
    const service = new ProjectAccessService(prisma as never);

    await expect(
      service.assertCanAccessProject(pm, 'p-assigned'),
    ).resolves.toBeUndefined();

    await expect(service.assertCanAccessProject(pm, 'p-other')).rejects.toThrow(
      'Project access denied',
    );

    await expect(service.assertCanAccessProject(pm, 'missing')).rejects.toThrow(
      'Project not found',
    );

    await expect(
      service.assertCanAccessProject(admin, 'p-other'),
    ).resolves.toBeUndefined();
  });

  it('denies PM access to null-project finance entities', async () => {
    const prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv-1',
          projectId: null,
        }),
      },
      document: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'doc-1',
          projectId: null,
        }),
      },
    };
    const service = new ProjectAccessService(prisma as never);

    await expect(service.assertCanAccessInvoice(pm, 'inv-1')).rejects.toThrow(
      'PROJECT_MANAGER requires an assigned project',
    );
    await expect(service.assertCanAccessDocument(pm, 'doc-1')).rejects.toThrow(
      'PROJECT_MANAGER requires an assigned project',
    );
  });

  it('scopes invoice/document where for PM', () => {
    const service = new ProjectAccessService({} as never);
    expect(service.invoiceWhere(pm)).toEqual({
      project: {
        is: { projectManagerId: 'pm-1', deletedAt: null },
      },
    });
    expect(service.documentWhere(admin)).toEqual({});
  });
});
