import { SVGProps } from "react";

export function Desktop(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      height="18"
      width="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Monitor screen */}
        <path d="M14.5 2.5H3.5C2.4 2.5 1.5 3.4 1.5 4.5v7c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2v-7c0-1.1-.9-2-2-2z" />
        {/* Stand neck */}
        <line x1="9" y1="13.5" x2="9" y2="15.5" />
        {/* Stand base */}
        <line x1="6.5" y1="15.5" x2="11.5" y2="15.5" />
      </g>
    </svg>
  );
}   
