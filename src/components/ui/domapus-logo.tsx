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
      <div className={cn("relative", sizeClasses[size])}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="60 48 922 918"
          className="w-full h-full"
          // Move rendering hints from style to direct props to fix TS error
          shapeRendering="geometricPrecision"
          textRendering="geometricPrecision"
          imageRendering="optimizeQuality"
          fillRule="evenodd"
          clipRule="evenodd"
        >
          <path
            style={{ opacity: 1 }}
            fill="currentColor"
            d="M599.5 969.5a47946 47946 0 0 0-438-1q-3.972-.357-5.5-4-.75-265.5-.5-531-1.76-3.006-5-4.5l-90-1q-2.844-2.712-1.5-6.5A85.4 85.4 0 0 1 70.5 411q-.342-.598-1-.5A210908 210908 0 0 0 502.5 50q9.211-5.049 18 1a60358 60358 0 0 0 320 265Q985.322 445.534 961 639.5 937.402 826.092 774.5 918q-81.922 44.606-175 51.5m273-427q-12.547-109.86-97-180.5a40179 40179 0 0 1-262-215q-2-1-4 0a29527 29527 0 0 0-271 226.5 76 76 0 0 0-6.5 8 3480 3480 0 0 0 0 118l2.5 2.5c71.999.667 143.999.5 216 .5h17a282 282 0 0 1 72 7.5Q679.637 546.536 695 690.5q8.445 111.188-67 192-2.234 6.5 4.5 7 16.65-3.08 33-7.5Q781.86 847.5 840 741.5q39.05-82.066 33.5-173-.357-13.007-1-26m-617 38q106-.25 212 .5 48.318.069 88 27 41.687 35.418 46.5 90.5 5.764 54.94-21 103-32.8 48.235-90.5 59.5a277 277 0 0 1-29 4q-103 .75-206 .5a10.5 10.5 0 0 0-2.5-3q-1-139.5 0-279a10.5 10.5 0 0 0 2.5-3"
          />
          <path
            fill="currentColor"
            style={{ opacity: 1 }}
            d="M427.5 290h68v68h-68zm96 0h68v68h-68zm-96 96h68v68h-68zm96 0h68v68h-68z"
          />
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