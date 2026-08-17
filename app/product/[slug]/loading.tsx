import MainLayoutShell from "@/app/MainLayoutShell";
import { LaunchFeedLoader } from "@/components/ui/LaunchFeedLoader";

export default function ProductLoading() {
  return (
    <MainLayoutShell>
      <div className="w-full min-h-[65vh] flex items-center justify-center p-8 bg-void">
        <LaunchFeedLoader size={36} />
      </div>
    </MainLayoutShell>
  );
}
