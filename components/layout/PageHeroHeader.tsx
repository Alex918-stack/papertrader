import type { LucideIcon } from "lucide-react";

interface PageHeroHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

export default function PageHeroHeader({
  icon: Icon,
  title,
  subtitle,
}: PageHeroHeaderProps) {
  return (
    <div className="ocean-gradient-hero rounded-3xl px-5 py-6 sm:px-8 sm:py-7 flex items-center gap-4">
      <div className="flex h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-coral-600 shadow-sm">
        <Icon size={22} />
      </div>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">
          {title}
        </h1>
        <p className="text-sm text-neutral-700 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}
