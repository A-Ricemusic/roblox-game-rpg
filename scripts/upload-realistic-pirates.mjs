import { createHash } from "node:crypto";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const exportRoot = resolve(root, "animation/exports/realistic-pirates");
const manifestPath = resolve(exportRoot, "roblox-model-manifest.json");
const apiKey = process.env.ROBLOX_OPEN_CLOUD_API_KEY;
const creatorId = process.env.ROBLOX_CREATOR_ID;
const creatorType = process.env.ROBLOX_CREATOR_TYPE;
if (!apiKey) throw new Error("ROBLOX_OPEN_CLOUD_API_KEY is required.");
if (!creatorId || !/^\d+$/.test(creatorId)) throw new Error("ROBLOX_CREATOR_ID must be numeric.");
if (creatorType !== "userId" && creatorType !== "groupId")
	throw new Error("ROBLOX_CREATOR_TYPE must be userId or groupId.");

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
async function requestJson(url, options) {
	const response = await fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(30_000) });
	const body = await response.text();
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body}`);
	return JSON.parse(body);
}

async function upload(fileName, bytes) {
	const displayName = basename(fileName, ".fbx");
	const request = {
		assetType: "Model",
		displayName,
		description: "Realistic rigged Sicilian pirate enemy for the Greek Odyssey RPG.",
		creationContext: { creator: { [creatorType]: creatorId }, expectedPrice: 0 },
	};
	const form = new FormData();
	form.append("request", JSON.stringify(request));
	form.append("fileContent", new Blob([bytes], { type: "model/fbx" }), fileName);
	let operation;
	for (let attempt = 0; attempt < 3 && operation === undefined; attempt += 1) {
		try {
			operation = await requestJson("https://apis.roblox.com/assets/v1/assets", {
				method: "POST",
				headers: { "x-api-key": apiKey },
				body: form,
			});
		} catch (uploadError) {
			if (attempt === 2) throw uploadError;
			await wait(3000);
		}
	}
	const operationId = (operation.path ?? operation.operationId ?? operation.name)?.match(
		/(?:operations\/)?([A-Za-z0-9_-]+)$/,
	)?.[1];
	if (!operationId) throw new Error(`Upload for ${fileName} returned no operation ID.`);
	for (let attempt = 0; attempt < 120 && !operation.done; attempt += 1) {
		await wait(2000);
		operation = await requestJson(`https://apis.roblox.com/assets/v1/operations/${operationId}`, {
			headers: { "x-api-key": apiKey },
		});
	}
	if (!operation.done || operation.error)
		throw new Error(`Upload for ${fileName} failed: ${JSON.stringify(operation.error)}`);
	if (!operation.response?.assetId) throw new Error(`Upload for ${fileName} returned no asset ID.`);
	return String(operation.response.assetId);
}

let manifest = { creatorId, creatorType, assets: {} };
try {
	manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
	if (error.code !== "ENOENT") throw error;
}
if (manifest.creatorId !== creatorId || manifest.creatorType !== creatorType)
	throw new Error("Pirate model manifest creator mismatch.");
for (const fileName of ["SicilianCorsair.fbx", "SicilianMarksman.fbx"]) {
	const filePath = resolve(exportRoot, fileName);
	if ((await stat(filePath)).size > 20 * 1024 * 1024) throw new Error(`${fileName} exceeds Roblox's 20 MB limit.`);
	const bytes = await readFile(filePath);
	const contentHash = createHash("sha256").update(bytes).digest("hex");
	const key = basename(fileName, ".fbx");
	if (manifest.assets[key]?.contentHash === contentHash) continue;
	manifest.assets[key] = { assetId: await upload(fileName, bytes), contentHash, source: fileName };
	const temporary = `${manifestPath}.tmp`;
	await writeFile(temporary, `${JSON.stringify(manifest, undefined, "\t")}\n`, { mode: 0o600 });
	await rename(temporary, manifestPath);
	process.stdout.write(`Uploaded ${key} as ${manifest.assets[key].assetId}\n`);
}
