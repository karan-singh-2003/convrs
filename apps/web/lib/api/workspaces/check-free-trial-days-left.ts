interface FreeTrialInfo {
  isActive: boolean;
  isExpired: boolean;
  daysLeft: number;
  hoursLeft: number;
  expiresAt: Date | null;
}

export function getFreeTrialInfo(
  freeTrialEndDate: Date | string | null
): FreeTrialInfo {
  if (!freeTrialEndDate) {
    return {
      isActive: false,
      isExpired: true,
      daysLeft: 0,
      hoursLeft: 0,
      expiresAt: null,
    };
  }

  const expiresAt = new Date(freeTrialEndDate);
  const now = new Date();

  const diffMs = expiresAt.getTime() - now.getTime();

  const isExpired = diffMs <= 0;

  return {
    isActive: !isExpired,
    isExpired,
    daysLeft: isExpired
      ? 0
      : Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
    hoursLeft: isExpired
      ? 0
      : Math.ceil(diffMs / (1000 * 60 * 60)),
    expiresAt,
  };
}