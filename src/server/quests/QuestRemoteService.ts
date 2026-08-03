import {
	parseQuestClientRequest,
	QUEST_REMOTE_EVENT_NAME,
	QUEST_REMOTES_FOLDER_NAME,
} from "shared/quests/QuestRemoteProtocol";
import { buildQuestClientViews } from "shared/quests/QuestViewModel";
import { QuestDefinition, QuestProfile, QuestServerMessage } from "shared/quests/QuestTypes";

import { QuestProfileService } from "./QuestProfileService";
import { getOrCreateFolder, getOrCreateRemoteEvent } from "server/remotes/RemoteInstanceFactory";

const REQUEST_COOLDOWN_SECONDS = 0.25;

export class QuestRemoteService {
	private readonly lastRequestAt = new Map<string, number>();

	public constructor(
		private readonly remote: RemoteEvent,
		private readonly profiles: QuestProfileService,
		private readonly definitions: ReadonlyArray<QuestDefinition>,
		private readonly clock: () => number = os.clock,
	) {}

	public start(profileKeyForPlayer: (player: Player) => string): RBXScriptConnection {
		return this.remote.OnServerEvent.Connect((player, payload: unknown) => {
			const profileKey = profileKeyForPlayer(player);
			if (this.acceptRequest(profileKey, payload)) this.sendSnapshot(player, profileKey);
		});
	}

	public acceptRequest(profileKey: string, payload: unknown): boolean {
		if (parseQuestClientRequest(payload) === undefined) return false;
		const now = this.clock();
		const previous = this.lastRequestAt.get(profileKey);
		if (previous !== undefined && now - previous < REQUEST_COOLDOWN_SECONDS) return false;
		this.lastRequestAt.set(profileKey, now);
		return true;
	}

	public forget(profileKey: string): void {
		this.lastRequestAt.delete(profileKey);
	}

	public sendSnapshot(player: Player, profileKey: string): boolean {
		const message = this.createSnapshot(profileKey);
		if (message === undefined) return false;
		this.remote.FireClient(player, message);
		return true;
	}

	public createSnapshot(profileKey: string): QuestServerMessage | undefined {
		const profile = this.profiles.get(profileKey);
		return profile === undefined ? undefined : this.snapshotFromProfile(profile);
	}

	private snapshotFromProfile(profile: QuestProfile): QuestServerMessage {
		return { kind: "Snapshot", quests: buildQuestClientViews(profile, this.definitions) };
	}
}

export function getOrCreateQuestRemote(): RemoteEvent {
	const replicatedStorage = game.GetService("ReplicatedStorage");
	const folder = getOrCreateFolder(replicatedStorage, QUEST_REMOTES_FOLDER_NAME);
	return getOrCreateRemoteEvent(folder, QUEST_REMOTE_EVENT_NAME);
}
