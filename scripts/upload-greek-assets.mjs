import { readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const exportRoot = resolve(root, "assets/blender/exports");
const manifestPath = resolve(root, "assets/blender/roblox-asset-manifest.json");
const apiKey = process.env.ROBLOX_OPEN_CLOUD_API_KEY;
const creatorId = process.env.ROBLOX_CREATOR_ID;
const creatorType = process.env.ROBLOX_CREATOR_TYPE;

if (!apiKey) {
	throw new Error("ROBLOX_OPEN_CLOUD_API_KEY is required and must never be committed.");
}
if (!creatorId || !/^\d+$/.test(creatorId) || creatorId === "0") {
	throw new Error("ROBLOX_CREATOR_ID must be an explicit positive numeric user or group ID.");
}
if (creatorType !== "userId" && creatorType !== "groupId") {
	throw new Error("ROBLOX_CREATOR_TYPE must be userId or groupId.");
}

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function requestJson(url, options) {
	const response = await fetch(url, {
		...options,
		redirect: "error",
		signal: AbortSignal.timeout(30_000),
	});
	const body = await response.text();
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body}`);
	return JSON.parse(body);
}

async function upload(fileName, fileBytes, contentHash) {
	const displayName = basename(fileName, ".fbx").replaceAll("_", " ");
	const request = {
		assetType: "Model",
		displayName,
		description: "Greek Odyssey environment kit asset generated from the project's Blender source.",
		creationContext: { creator: { [creatorType]: creatorId }, expectedPrice: 0 },
	};
	const form = new FormData();
	form.append("request", JSON.stringify(request));
	form.append("fileContent", new Blob([fileBytes], { type: "model/fbx" }), fileName);
	let operation = await requestJson("https://apis.roblox.com/assets/v1/assets", {
		method: "POST",
		headers: { "x-api-key": apiKey },
		body: form,
	});
	const operationPath = operation.path ?? operation.operationId ?? operation.name;
	const operationMatch =
		typeof operationPath === "string" ? operationPath.match(/^(?:operations\/)?([A-Za-z0-9_-]+)$/) : undefined;
	if (!operationMatch) throw new Error(`Upload for ${fileName} returned an invalid operation identifier.`);
	const operationUrl = `https://apis.roblox.com/assets/v1/operations/${operationMatch[1]}`;
	for (let attempt = 0; attempt < 90 && !operation.done; attempt += 1) {
		await wait(2000);
		operation = await requestJson(operationUrl, { headers: { "x-api-key": apiKey } });
	}
	if (!operation.done) throw new Error(`Upload for ${fileName} timed out.`);
	if (operation.error) throw new Error(`Upload for ${fileName} failed: ${JSON.stringify(operation.error)}`);
	const assetId = operation.response?.assetId;
	if (!assetId) throw new Error(`Upload for ${fileName} completed without an asset ID.`);
	return { assetId: String(assetId), contentHash, displayName, source: `exports/${fileName}` };
}

const requestedKeys = new Set(process.argv.slice(2));
const files = (await readdir(exportRoot))
	.filter((fileName) => fileName.endsWith(".fbx"))
	.filter((fileName) => requestedKeys.size === 0 || requestedKeys.has(basename(fileName, ".fbx")))
	.sort();
if (files.length === 0) throw new Error("No FBX exports were found. Generate the Blender kit first.");
let manifest;
try {
	manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
	if (error.code !== "ENOENT") throw error;
	manifest = { creatorId, creatorType, assets: {} };
}
if (manifest.creatorId !== creatorId || manifest.creatorType !== creatorType) {
	throw new Error("The existing asset manifest belongs to a different Roblox creator.");
}
const writeManifest = async () => {
	const temporaryPath = `${manifestPath}.tmp`;
	await writeFile(temporaryPath, `${JSON.stringify(manifest, undefined, "\t")}\n`, { mode: 0o600 });
	await rename(temporaryPath, manifestPath);
};
for (const fileName of files) {
	const key = basename(fileName, ".fbx");
	const filePath = resolve(exportRoot, fileName);
	const fileSize = (await stat(filePath)).size;
	if (fileSize > 20 * 1024 * 1024) throw new Error(`${fileName} exceeds Roblox's 20 MB asset limit.`);
	const fileBytes = await readFile(filePath);
	const contentHash = createHash("sha256").update(fileBytes).digest("hex");
	if (manifest.assets[key]?.contentHash === contentHash) {
		process.stdout.write(`Reusing ${key} as ${manifest.assets[key].assetId}\n`);
		continue;
	}
	manifest.assets[key] = await upload(fileName, fileBytes, contentHash);
	await writeManifest();
	process.stdout.write(`Uploaded ${key} as ${manifest.assets[key].assetId}\n`);
}
