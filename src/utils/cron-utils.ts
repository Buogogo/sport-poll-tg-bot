export function buildCronExpression(targetTime: Date): string {
  return `${targetTime.getUTCMinutes()} ${targetTime.getUTCHours()} * * ${targetTime.getUTCDay()}`;
}
