import { LaunchFeedLoader } from "@/components/ui/LaunchFeedLoader";

export default function Loading() {
  return (
    <div className="flex-1 min-h-[60vh] w-full flex items-center justify-center p-6 bg-void">
      <div className="flex flex-col items-center justify-center gap-4">
        <LaunchFeedLoader size={36} />
      </div>
    </div>
  );
}
