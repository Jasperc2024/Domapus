import { cn } from "@/lib/utils";

interface DomapusLogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export function DomapusLogo({
  className,
  showText = true,
  size = "md",
}: DomapusLogoProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  };

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      {/* Logo icon - stylized map/house combination */}
      <div className={cn("relative", sizeClasses[size])}>
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Map outline */}
          <path
            d="M4 6h24c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V8c0-1.1.9-2 2-2z"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />

          {/* House shape overlay */}
          <path d="M12 10l4-3 4 3v8h-2v-4h-4v4h-2v-8z" fill="currentColor" />

          {/* Map grid lines */}
          <path
            d="M8 12h16M8 16h16M8 20h16M12 8v16M20 8v16"
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.3"
          />

          {/* Data points */}
          <circle cx="10" cy="14" r="1" fill="currentColor" opacity="0.6" />
          <circle cx="14" cy="18" r="1" fill="currentColor" opacity="0.6" />
          <circle cx="22" cy="12" r="1" fill="currentColor" opacity="0.6" />
          <circle cx="24" cy="20" r="1" fill="currentColor" opacity="0.6" />
        </svg>
      </div>

      {showText && (
        <span className={cn("font-bold text-gray-800", textSizeClasses[size])}>
          Domapus
        </span>
      )}
    </div>
  );
}
