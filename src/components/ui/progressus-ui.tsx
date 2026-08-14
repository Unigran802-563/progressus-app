import { ReactNode } from 'react';
import { clsx } from 'clsx';

type Tone = 'neutral' | 'primary' | 'info' | 'progress' | 'success' | 'warning' | 'danger';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-accent text-muted-foreground',
  primary: 'bg-primary/15 text-primary',
  info: 'bg-info/15 text-info',
  progress: 'bg-progress/15 text-progress',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
};

const progressClasses: Record<Exclude<Tone, 'neutral'>, string> = {
  primary: 'bg-primary',
  info: 'bg-info',
  progress: 'bg-progress',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

const avatarClasses: Record<Exclude<Tone, 'neutral'>, string> = {
  primary: 'bg-primary/15 text-primary ring-primary/25',
  info: 'bg-info/15 text-info ring-info/25',
  progress: 'bg-progress/15 text-progress ring-progress/25',
  success: 'bg-success/15 text-success ring-success/25',
  warning: 'bg-warning/15 text-warning ring-warning/25',
  danger: 'bg-danger/15 text-danger ring-danger/25',
};

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate font-display text-2xl font-bold text-foreground sm:text-[28px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx('surface-panel overflow-hidden', className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="font-display text-sm font-semibold text-foreground">{title}</h2>
          {action}
        </div>
      )}
      <div className={clsx('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function ProgressBar({
  value,
  tone = 'primary',
  className,
}: {
  value: number;
  tone?: Exclude<Tone, 'neutral'>;
  className?: string;
}) {
  const safeValue = Math.max(0, Math.min(value, 100));

  return (
    <div
      className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-accent', className)}
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={clsx('h-full rounded-full transition-all duration-500', progressClasses[tone])}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  initials,
  name,
  tone = 'primary',
  size = 'md',
  className,
}: {
  initials: string;
  name?: string;
  tone?: Exclude<Tone, 'neutral'>;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    xs: 'size-6 text-[10px]',
    sm: 'size-7 text-[11px]',
    md: 'size-9 text-xs',
    lg: 'size-11 text-sm',
  };

  return (
    <span
      title={name}
      className={clsx(
        'grid shrink-0 place-items-center rounded-full font-semibold ring-1',
        sizeClasses[size],
        avatarClasses[tone],
        className
      )}
    >
      {initials}
    </span>
  );
}

export type AvatarMember = {
  initials: string;
  name: string;
  tone: Exclude<Tone, 'neutral'>;
};

export function AvatarStack({ members, max = 3 }: { members: AvatarMember[]; max?: number }) {
  const visibleMembers = members.slice(0, max);
  const extraMembers = members.length - visibleMembers.length;

  return (
    <div className="flex items-center">
      {visibleMembers.map((member, index) => (
        <Avatar
          key={`${member.name}-${index}`}
          initials={member.initials}
          name={member.name}
          tone={member.tone}
          size="sm"
          className={clsx('-ml-1.5 ring-2 ring-card first:ml-0')}
        />
      ))}
      {extraMembers > 0 && (
        <span className="-ml-1.5 grid size-7 place-items-center rounded-full bg-accent text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
          +{extraMembers}
        </span>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent text-muted-foreground">
        {icon}
      </span>
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Sparkline({
  points,
  tone = 'primary',
}: {
  points: number[];
  tone?: Exclude<Tone, 'neutral'>;
}) {
  const max = Math.max(...points, 1);
  const strokeClass: Record<Exclude<Tone, 'neutral'>, string> = {
    primary: 'text-primary',
    info: 'text-info',
    progress: 'text-progress',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };

  const path = points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 24 - (point / max) * 20;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 26" className={clsx('h-6 w-20', strokeClass[tone])} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
