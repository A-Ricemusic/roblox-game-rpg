export function getOrCreateFolder(parent: Instance, name: string): Folder {
	const existing = parent.FindFirstChild(name);
	if (existing !== undefined) {
		assert(existing.IsA("Folder"), `${existing.GetFullName()} must be a Folder.`);
		return existing;
	}

	const folder = new Instance("Folder");
	folder.Name = name;
	folder.Parent = parent;
	return folder;
}

export function getOrCreateRemoteEvent(parent: Instance, name: string): RemoteEvent {
	const existing = parent.FindFirstChild(name);
	if (existing !== undefined) {
		assert(existing.IsA("RemoteEvent"), `${existing.GetFullName()} must be a RemoteEvent.`);
		return existing;
	}

	const remote = new Instance("RemoteEvent");
	remote.Name = name;
	remote.Parent = parent;
	return remote;
}
