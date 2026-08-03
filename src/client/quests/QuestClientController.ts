import { ReplicatedStorage } from "@rbxts/services";

import {
	parseQuestServerMessage,
	QUEST_REMOTE_EVENT_NAME,
	QUEST_REMOTES_FOLDER_NAME,
} from "shared/quests/QuestRemoteProtocol";

import { QuestHud } from "./QuestHud";

export interface QuestClientRemote {
	onMessage(callback: (payload: unknown) => void): RBXScriptConnection;
	requestSnapshot(): void;
}

export class RobloxQuestClientRemote implements QuestClientRemote {
	public constructor(private readonly remote = RobloxQuestClientRemote.getRemote()) {}

	public onMessage(callback: (payload: unknown) => void): RBXScriptConnection {
		return this.remote.OnClientEvent.Connect(callback);
	}

	public requestSnapshot(): void {
		this.remote.FireServer({ kind: "RequestSnapshot" });
	}

	private static getRemote(): RemoteEvent {
		const folder = ReplicatedStorage.WaitForChild(QUEST_REMOTES_FOLDER_NAME);
		const remote = folder.WaitForChild(QUEST_REMOTE_EVENT_NAME);
		assert(remote.IsA("RemoteEvent"), `${QUEST_REMOTE_EVENT_NAME} must be a RemoteEvent.`);
		return remote;
	}
}

export class QuestClientController {
	private connection?: RBXScriptConnection;

	public constructor(
		private readonly hud: QuestHud,
		private readonly remote: QuestClientRemote = new RobloxQuestClientRemote(),
	) {}

	public start(): void {
		if (this.connection !== undefined) return;
		this.connection = this.remote.onMessage((payload) => {
			const message = parseQuestServerMessage(payload);
			if (message !== undefined) this.hud.render(message.quests);
		});
		this.remote.requestSnapshot();
	}

	public stop(): void {
		this.connection?.Disconnect();
		this.connection = undefined;
	}
}
