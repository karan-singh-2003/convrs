export default function IsometricBoxes({
  count = 0,
  size = 19,
}: {
  count?: number;
  size?: number;
}) {
  // Box order: bottom, left, right, top (most prominent first)
  const isBlue = (boxIndex: number) => boxIndex < count;

  const blueBox = {
    fill: "#C9E0FF",
    stroke: "#5385E0",
    lineStroke: "#5385E0",
  };
  const grayBox = {
    fill: "#F4F4F4",
    stroke: "#EDEDED",
    lineStroke: "#EDEDED",
  };

  const bottom = isBlue(0) ? blueBox : grayBox;
  const left = isBlue(1) ? blueBox : grayBox;
  const right = isBlue(2) ? blueBox : grayBox;
  const top = isBlue(3) ? blueBox : grayBox;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size * (16 / 19)}
      viewBox="0 0 19 16"
      fill="none"
    >
      <g clipPath="url(#clip0_291_530)">
        {/* Top center box */}
        <path
          d="M5.06534 2.53635L8.91346 0.337432C9.11062 0.224762 9.35268 0.224762 9.54983 0.337432L13.398 2.53635C13.5978 2.65053 13.7211 2.86304 13.7211 3.0932V7.47964C13.7211 7.70979 13.5978 7.92227 13.398 8.03646L9.54983 10.2354C9.35268 10.3481 9.11062 10.3481 8.91346 10.2354L5.06534 8.03646C4.86551 7.92227 4.74219 7.70979 4.74219 7.47964V3.0932C4.74219 2.86304 4.86551 2.65053 5.06534 2.53635Z"
          fill={top.fill}
          stroke={top.stroke}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.23194 5.28699L4.88281 2.80176M9.23194 5.28699L13.6016 2.79004M9.23194 5.28699V10.2574"
          stroke={top.lineStroke}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={top === grayBox ? 1 : 0.4}
        />

        {/* Right box */}
        <path
          d="M9.55561 5.10178L13.4037 2.90286C13.6009 2.79019 13.843 2.79019 14.0401 2.90286L17.8882 5.10178C18.088 5.21597 18.2114 5.42847 18.2114 5.65862V10.0451C18.2114 10.2752 18.088 10.4877 17.8882 10.6019L14.0401 12.8008C13.843 12.9135 13.6009 12.9135 13.4037 12.8008L9.55561 10.6019C9.3558 10.4877 9.23242 10.2752 9.23242 10.0451V5.65862C9.23242 5.42847 9.3558 5.21597 9.55561 5.10178Z"
          fill={right.fill}
          stroke={right.stroke}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          opacity="0.4"
          d="M13.7222 7.85142L9.37305 5.36621M13.7222 7.85142L18.0919 5.35449M13.7222 7.85142V12.8219"
          stroke={right.lineStroke}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Left box */}
        <path
          d="M0.576082 5.10178L4.42418 2.90286C4.62136 2.79019 4.86341 2.79019 5.06058 2.90286L8.9087 5.10178C9.10851 5.21597 9.23182 5.42847 9.23182 5.65862V10.0451C9.23182 10.2752 9.10851 10.4877 8.9087 10.6019L5.06058 12.8008C4.86341 12.9135 4.62135 12.9135 4.42418 12.8008L0.576081 10.6019C0.376252 10.4877 0.25293 10.2752 0.25293 10.0451V5.65862C0.25293 5.42847 0.376253 5.21597 0.576082 5.10178Z"
          fill={left.fill}
          stroke={left.stroke}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          opacity="0.4"
          d="M4.74271 7.85142L0.393555 5.36621M4.74271 7.85142L9.11235 5.35449M4.74271 7.85142V12.8219"
          stroke={left.lineStroke}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Bottom center box */}
        <path
          d="M5.06534 7.6672L8.91346 5.46829C9.11062 5.35562 9.35268 5.35562 9.54983 5.46829L13.398 7.6672C13.5978 7.78139 13.7211 7.99387 13.7211 8.22403V12.6105C13.7211 12.8406 13.5978 13.0531 13.398 13.1673L9.54983 15.3663C9.35268 15.4789 9.11062 15.4789 8.91346 15.3663L5.06534 13.1673C4.86551 13.0531 4.74219 12.8406 4.74219 12.6105V8.22403C4.74219 7.99387 4.86551 7.78139 5.06534 7.6672Z"
          fill={bottom.fill}
          stroke={bottom.stroke}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          opacity="0.4"
          d="M9.23199 10.4169L4.88281 7.93164M9.23199 10.4169L13.6016 7.91992M9.23199 10.4169V15.3874"
          stroke={bottom.lineStroke}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="clip0_291_530">
          <rect width="19" height="15.8333" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}