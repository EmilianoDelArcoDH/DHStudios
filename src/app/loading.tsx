import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid h-screen grid-cols-[16rem_1fr_20rem] gap-0">
      <Skeleton className="h-full rounded-none" />
      <Skeleton className="h-full rounded-none" />
      <Skeleton className="h-full rounded-none" />
    </div>
  );
}
