import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  rightContent?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  rightContent,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {rightContent ? (
        <div className="flex shrink-0 items-center gap-2">{rightContent}</div>
      ) : null}
    </div>
  );
}
