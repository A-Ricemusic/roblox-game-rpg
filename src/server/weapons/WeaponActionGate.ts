import {
	advanceLightCombo,
	LIGHT_COMBO_MINIMUM_INTERVALS,
	LightComboState,
	LightComboStep,
} from "shared/weapons/LightCombo";

interface PlayerActionState {
	readonly combo?: LightComboState;
	readonly nextAllowedAt: number;
}

export class WeaponActionGate {
	private readonly stateByPlayerId = new Map<number, PlayerActionState>();

	public tryLightSwing(playerId: number, now: number): LightComboStep | undefined {
		const previous = this.stateByPlayerId.get(playerId);
		if (previous !== undefined && now < previous.nextAllowedAt) {
			return undefined;
		}

		const advance = advanceLightCombo(previous?.combo, now);
		this.stateByPlayerId.set(playerId, {
			combo: advance.state,
			nextAllowedAt: now + LIGHT_COMBO_MINIMUM_INTERVALS[advance.step],
		});
		return advance.step;
	}

	public forget(playerId: number): void {
		this.stateByPlayerId.delete(playerId);
	}

	/** Restarts combo sequencing without bypassing an attack already on cooldown. */
	public resetCombo(playerId: number): void {
		const previous = this.stateByPlayerId.get(playerId);
		if (previous !== undefined) {
			this.stateByPlayerId.set(playerId, { nextAllowedAt: previous.nextAllowedAt });
		}
	}

	public clear(): void {
		this.stateByPlayerId.clear();
	}
}
