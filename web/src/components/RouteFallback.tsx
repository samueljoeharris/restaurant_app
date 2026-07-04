import { Skeleton } from "./ui/Skeleton";

/** Content-area placeholder while a lazy route chunk loads. */
export function RouteFallback() {
  return (
    <div className="grid w-full flex-1 content-start gap-3 px-4 py-6 md:px-8">
      <Skeleton className="h-4 w-[55%]" />
      <Skeleton className="h-3 w-[85%]" />
      <Skeleton className="h-3 w-[70%]" />
    </div>
  );
}
