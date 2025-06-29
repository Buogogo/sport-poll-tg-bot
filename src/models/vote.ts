import { MESSAGES } from "../constants/messages.ts";

export class Vote {
  public readonly id?: string;
  public readonly timestamp: Date;

  constructor(
    public readonly optionId: number, // 0 = positive, 1 = negative
    public readonly userId?: number,
    public readonly userName?: string,
    public readonly requesterId?: number,
    public readonly requesterName?: string,
  ) {
    this.timestamp = new Date();
  }

  get isAnonymous(): boolean {
    return !this.userName;
  }

  get displayName(): string {
    return this.userName || MESSAGES.ANONYMOUS_USER;
  }
}
