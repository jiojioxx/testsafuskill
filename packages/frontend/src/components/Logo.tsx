export default function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer hex — wireframe */}
      <polygon
        points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5"
        stroke="rgb(var(--primary))"
        strokeWidth="1.8"
        strokeLinejoin="round"
        opacity="0.25"
      />
      {/* Mid hex — stronger outline */}
      <polygon
        points="16,7 24,11.5 24,20.5 16,25 8,20.5 8,11.5"
        stroke="rgb(var(--primary))"
        strokeWidth="1.8"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {/* Inner hex — solid fill */}
      <polygon
        points="16,11 21,13.8 21,19.2 16,22 11,19.2 11,13.8"
        fill="rgb(var(--primary))"
      />
      {/* Center spark */}
      <circle cx="16" cy="16.5" r="2" fill="white" fillOpacity="0.3" />
    </svg>
  );
}
