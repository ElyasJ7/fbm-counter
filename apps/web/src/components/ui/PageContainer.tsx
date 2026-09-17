import { cn } from '../../lib/cn';

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
};

/** Standard content width + vertical rhythm for authenticated pages. */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('page-container space-y-6', className)}>{children}</div>
  );
}
