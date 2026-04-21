/**
 * PJ03 SelfDrive — Clock interface (T-1-10 P3 akaghef 指示)
 *
 * reducer は Date.now() を直参照しない。Clock を injection で受け取る。
 * test では FixedClock / AdvanceableClock を使い、時刻を決定論的に制御する。
 */

export interface Clock {
  /** 現在時刻 (ms since epoch 等に相当するが、ISO 相互運用を簡単にするため Date) */
  now(): Date;
}

/**
 * SystemClock — 本番用。new Date() を呼ぶだけ。
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/**
 * FixedClock — test 用。固定時刻を返す。
 */
export class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return new Date(this.fixed.getTime());
  }
}

/**
 * AdvanceableClock — test 用。手動で時刻を進められる。
 */
export class AdvanceableClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return new Date(this.current.getTime());
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
  set(at: Date): void {
    this.current = new Date(at.getTime());
  }
}
