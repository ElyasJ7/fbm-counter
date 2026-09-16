import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { LoginPage } from './pages/LoginPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectFormPage } from './pages/ProjectFormPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SubcontractorDetailPage } from './pages/SubcontractorDetailPage';
import { SubcontractorsPage } from './pages/SubcontractorsPage';
import { SupplierDetailPage } from './pages/SupplierDetailPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { UsersPage } from './pages/UsersPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/new" element={<ProjectFormPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="projects/:id/edit" element={<ProjectFormPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route
              path="finances"
              element={
                <PlaceholderPage
                  title="Finances"
                  description="Company-wide financial overview and ledgers."
                  phase="Phase 4"
                />
              }
            />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="suppliers/:id" element={<SupplierDetailPage />} />
            <Route path="subcontractors" element={<SubcontractorsPage />} />
            <Route
              path="subcontractors/:id"
              element={<SubcontractorDetailPage />}
            />
            <Route
              path="documents"
              element={
                <PlaceholderPage
                  title="Documents"
                  description="Secure document storage linked to projects and records."
                  phase="Phase 6"
                />
              }
            />
            <Route
              path="reports"
              element={
                <PlaceholderPage
                  title="Reports"
                  description="Profitability, cash flow, and exportable financial reports."
                  phase="Phase 7"
                />
              }
            />
            <Route path="users" element={<UsersPage />} />
            <Route
              path="settings"
              element={
                <PlaceholderPage
                  title="Settings"
                  description="Company profile, VAT defaults, and system configuration."
                  phase="Phase 8"
                />
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
