import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputRoot = resolve(root, "animation/exports/hoplite/roblox");
const manifestPath = resolve(outputRoot, "animation-manifest.json");
const apiKey = process.env.ROBLOX_OPEN_CLOUD_API_KEY;
const creatorId = process.env.ROBLOX_CREATOR_ID;
const creatorType = process.env.ROBLOX_CREATOR_TYPE;
const animationNames = [
	"SwordAttack01_DownwardDiagonal",
	"SwordAttack02_RisingDiagonal",
	"SwordAttack03_ForwardThrust",
	"SwordAttack04_Whirlwind",
];

if (!apiKey) throw new Error("ROBLOX_OPEN_CLOUD_API_KEY is required.");
if (!creatorId || !/^\d+$/.test(creatorId)) throw new Error("ROBLOX_CREATOR_ID must be numeric.");
if (creatorType !== "userId" && creatorType !== "groupId") {
	throw new Error("ROBLOX_CREATOR_TYPE must be userId or groupId.");
}

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function requestJson(url, options) {
	const response = await fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(30_000) });
	const body = await response.text();
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body}`);
	return JSON.parse(body);
}

async function upload(name, bytes) {
	const request = {
		assetType: "Animation",
		displayName: name,
		description: "Authored Hoplite sword combo animation for the Greek Odyssey RPG.",
		creationContext: { creator: { [creatorType]: creatorId }, expectedPrice: 0 },
	};
	const form = new FormData();
	form.append("request", JSON.stringify(request));
	form.append("fileContent", new Blob([bytes], { type: "model/x-rbxm" }), `${name}.rbxmx`);
	let operation = await requestJson("https://apis.roblox.com/assets/v1/assets", {
		method: "POST",
		headers: { "x-api-key": apiKey },
		body: form,
	});
	const operationId = (operation.path ?? operation.operationId ?? operation.name)?.match(
		/(?:operations\/)?([A-Za-z0-9_-]+)$/,
	)?.[1];
	if (!operationId) throw new Error(`Upload for ${name} returned no operation ID.`);
	for (let attempt = 0; attempt < 90 && !operation.done; attempt += 1) {
		await wait(2_000);
		operation = await requestJson(`https://apis.roblox.com/assets/v1/operations/${operationId}`, {
			headers: { "x-api-key": apiKey },
		});
	}
	if (!operation.done || operation.error) {
		throw new Error(`Upload for ${name} failed: ${JSON.stringify(operation.error)}`);
	}
	if (!operation.response?.assetId) throw new Error(`Upload for ${name} returned no asset ID.`);
	return String(operation.response.assetId);
}

let manifest = { creatorId, creatorType, assets: {} };
try {
	manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
	if (error.code !== "ENOENT") throw error;
}
if (manifest.creatorId !== creatorId || manifest.creatorType !== creatorType) {
	throw new Error("Animation manifest creator mismatch.");
}

for (const name of animationNames) {
	const source = `${name}.rbxmx`;
	const bytes = await readFile(resolve(outputRoot, source));
	const contentHash = createHash("sha256").update(bytes).digest("hex");
	if (manifest.assets[name]?.contentHash === contentHash) continue;
	const assetId = await upload(name, bytes);
	manifest.assets[name] = { assetId, contentHash, source };
	const temporary = `${manifestPath}.tmp`;
	await writeFile(temporary, `${JSON.stringify(manifest, undefined, "\t")}\n`, { mode: 0o600 });
	await rename(temporary, manifestPath);
	process.stdout.write(`Uploaded ${name} as ${assetId}\n`);
}
