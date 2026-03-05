export function XLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <circle cx="12" cy="12" r="12" fill="black" />
      <path
        d="M13.544 10.72 17.88 5.8h-1.03l-3.763 4.27L10.33 5.8H6.497l4.546 6.456L6.497 17.6h1.03l3.975-4.51L14.37 17.6h3.833l-4.66-6.88Zm-1.407 1.597-.46-.644L7.82 6.56h1.578l2.96 4.133.461.643 3.846 5.37h-1.578l-3.14-4.389Z"
        fill="white"
      />
    </svg>
  );
}
