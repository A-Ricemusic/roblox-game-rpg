import { LIGHT_SWING_COOLDOWN_SECONDS } from "shared/weapons/WeaponConstants";

export class WeaponActionGate {
	private readonly nextAllowedAtByPlayerId = new Map<number, number>();

	public tryLightSwing(playerId: number, now: number): boolean {
		const nextAllowedAt = this.nextAllowedAtByPlayerId.get(playerId) ?? 0;
		if (now < nextAllowedAt) {
			return false;
		}

		this.nextAllowedAtByPlayerId.set(playerId, now + LIGHT_SWING_COOLDOWN_SECONDS);
		return true;
	}

	public forget(playerId: number): void {
		this.nextAllowedAtByPlayerId.delete(playerId);
	}

	public clear(): void {
		this.nextAllowedAtByPlayerId.clear();
	}
}
