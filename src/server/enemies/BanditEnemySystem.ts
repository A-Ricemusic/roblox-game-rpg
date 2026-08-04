import { CollectionService, Players, RunService } from "@rbxts/services";

import { BANDIT_TAG, readBanditTuning } from "./BanditConstants";
import { BanditAnimator } from "./BanditAnimator";
import { getBanditCombatDecision } from "./BanditCombatDecision";
import { findNearestLivingTarget } from "./BanditTargeting";

interface ActiveBandit {
	model: Model;
	humanoid: Humanoid;
	root: BasePart;
	animator: BanditAnimator;
	nextAttackAt: number;
	deathConnection: RBXScriptConnection;
}

const ATTACK_CONTACT_DELAY_SECONDS = 0.4;

function silenceCharacter(model: Model): void {
	for (const descendant of model.GetDescendants()) {
		if (!descendant.IsA("Sound")) continue;
		descendant.Stop();
		descendant.Destroy();
	}
}

function showCrossbowBolt(origin: Vector3, target: Vector3): void {
	const delta = target.sub(origin);
	const bolt = new Instance("Part");
	bolt.Name = "CrossbowBoltTracer";
	bolt.Anchored = true;
	bolt.CanCollide = false;
	bolt.CanQuery = false;
	bolt.Material = Enum.Material.Neon;
	bolt.Color = Color3.fromRGB(255, 205, 112);
	bolt.Size = new Vector3(0.08, 0.08, math.max(0.2, delta.Magnitude));
	bolt.CFrame = CFrame.lookAt(origin.add(delta.div(2)), target);
	bolt.Parent = game.Workspace;
	task.delay(0.12, () => bolt.Destroy());
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
		for (const [, bandit] of this.active) {
			bandit.animator.reset();
			bandit.deathConnection.Disconnect();
		}
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
		const deathConnection = humanoid.Died.Connect(() => {
			silenceCharacter(instance);
			task.defer(() => silenceCharacter(instance));
		});
		this.active.set(instance, {
			model: instance,
			humanoid,
			root,
			animator: new BanditAnimator(instance),
			nextAttackAt: 0,
			deathConnection,
		});
	}

	private unregister(instance: Instance): void {
		if (!instance.IsA("Model")) return;
		const bandit = this.active.get(instance);
		bandit?.animator.reset();
		bandit?.deathConnection.Disconnect();
		this.active.delete(instance);
	}

	private update(deltaTime: number): void {
		const now = os.clock();
		const characters = Players.GetPlayers().map((player) => player.Character);
		for (const [model, bandit] of this.active) {
			if (model.Parent === undefined || bandit.humanoid.Health <= 0) {
				bandit.animator.reset();
				bandit.deathConnection.Disconnect();
				this.active.delete(model);
				continue;
			}
			const tuning = readBanditTuning(model);
			const ranged = model.GetAttribute("BanditArchetype") === "Ranged";
			const preferredRangeAttribute = model.GetAttribute("PreferredRange");
			const preferredRange = typeIs(preferredRangeAttribute, "number") ? preferredRangeAttribute : 28;
			bandit.humanoid.WalkSpeed = tuning.walkSpeed;
			const target = findNearestLivingTarget(bandit.root.Position, characters, tuning.detectionRadius);
			if (target === undefined) {
				bandit.humanoid.Move(Vector3.zero);
				bandit.animator.update(deltaTime, now, false);
				continue;
			}
			const distance = target.root.Position.sub(bandit.root.Position).Magnitude;
			const decision = getBanditCombatDecision(distance, ranged, tuning.attackRange, preferredRange);
			if (decision === "Advance") {
				bandit.humanoid.MoveTo(target.root.Position);
				bandit.animator.update(deltaTime, now, true);
				continue;
			}
			if (decision === "Retreat") {
				const retreatDirection = bandit.root.Position.sub(target.root.Position).Unit;
				bandit.humanoid.MoveTo(bandit.root.Position.add(retreatDirection.mul(12)));
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
				task.delay(ATTACK_CONTACT_DELAY_SECONDS, () => {
					if (this.active.get(model) !== bandit || bandit.humanoid.Health <= 0 || target.humanoid.Health <= 0)
						return;
					const contactDistance = target.root.Position.sub(bandit.root.Position).Magnitude;
					if (contactDistance > tuning.attackRange) return;
					if (ranged) {
						showCrossbowBolt(bandit.root.Position.add(new Vector3(0, 1.4, 0)), target.root.Position);
					}
					target.humanoid.TakeDamage(tuning.damage);
				});
			}
			bandit.animator.update(deltaTime, now, false);
		}
	}
}
