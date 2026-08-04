import { CollectionService, Players, RunService } from "@rbxts/services";

import { BANDIT_TAG, readBanditTuning } from "./BanditConstants";
import { BanditAnimator } from "./BanditAnimator";
import { findNearestLivingTarget } from "./BanditTargeting";

interface ActiveBandit {
	model: Model;
	humanoid: Humanoid;
	root: BasePart;
	animator: BanditAnimator;
	nextAttackAt: number;
}

export class BanditEnemySystem {
	private readonly active = new Map<Model, ActiveBandit>();
	private readonly connections = new Array<RBXScriptConnection>();

	public start(): void {
		if (this.connections.size() > 0) return;
		this.connections.push(
			CollectionService.GetInstanceAddedSignal(BANDIT_TAG).Connect((instance) => this.register(instance)),
		);
		this.connections.push(
			CollectionService.GetInstanceRemovedSignal(BANDIT_TAG).Connect((instance) => this.unregister(instance)),
		);
		this.connections.push(RunService.Heartbeat.Connect((deltaTime) => this.update(deltaTime)));
		for (const instance of CollectionService.GetTagged(BANDIT_TAG)) this.register(instance);
	}

	public stop(): void {
		for (const connection of this.connections) connection.Disconnect();
		this.connections.clear();
		for (const [, bandit] of this.active) bandit.animator.reset();
		this.active.clear();
	}

	public size(): number {
		return this.active.size();
	}

	private register(instance: Instance): void {
		if (!instance.IsA("Model") || this.active.has(instance)) return;
		const humanoid = instance.FindFirstChildOfClass("Humanoid");
		const root = instance.FindFirstChild("HumanoidRootPart");
		if (humanoid === undefined || !root?.IsA("BasePart")) {
			warn(`[BanditEnemySystem] ${instance.GetFullName()} needs a Humanoid and HumanoidRootPart.`);
			return;
		}
		const [canSetNetworkOwner] = root.CanSetNetworkOwnership();
		if (canSetNetworkOwner) root.SetNetworkOwner(undefined);
		this.active.set(instance, {
			model: instance,
			humanoid,
			root,
			animator: new BanditAnimator(instance),
			nextAttackAt: 0,
		});
	}

	private unregister(instance: Instance): void {
		if (!instance.IsA("Model")) return;
		this.active.get(instance)?.animator.reset();
		this.active.delete(instance);
	}

	private update(deltaTime: number): void {
		const now = os.clock();
		const characters = Players.GetPlayers().map((player) => player.Character);
		for (const [model, bandit] of this.active) {
			if (model.Parent === undefined || bandit.humanoid.Health <= 0) {
				bandit.animator.reset();
				this.active.delete(model);
				continue;
			}
			const tuning = readBanditTuning(model);
			bandit.humanoid.WalkSpeed = tuning.walkSpeed;
			const target = findNearestLivingTarget(bandit.root.Position, characters, tuning.detectionRadius);
			if (target === undefined) {
				bandit.humanoid.Move(Vector3.zero);
				bandit.animator.update(deltaTime, now, false);
				continue;
			}
			const distance = target.root.Position.sub(bandit.root.Position).Magnitude;
			if (distance > tuning.attackRange) {
				bandit.humanoid.MoveTo(target.root.Position);
				bandit.animator.update(deltaTime, now, true);
				continue;
			}
			bandit.humanoid.Move(Vector3.zero);
			bandit.root.CFrame = CFrame.lookAt(
				bandit.root.Position,
				new Vector3(target.root.Position.X, bandit.root.Position.Y, target.root.Position.Z),
			);
			if (now >= bandit.nextAttackAt) {
				bandit.nextAttackAt = now + tuning.attackCooldown;
				bandit.animator.beginAttack(now);
				target.humanoid.TakeDamage(tuning.damage);
			}
			bandit.animator.update(deltaTime, now, false);
		}
	}
}
