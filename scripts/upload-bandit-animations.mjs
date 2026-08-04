import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputRoot = resolve(root, "animation/exports/bandit/roblox");
const manifestPath = resolve(outputRoot, "animation-manifest.json");
const apiKey = process.env.ROBLOX_OPEN_CLOUD_API_KEY;
const creatorId = process.env.ROBLOX_CREATOR_ID;
const creatorType = process.env.ROBLOX_CREATOR_TYPE;

if (!apiKey) throw new Error("ROBLOX_OPEN_CLOUD_API_KEY is required.");
if (!creatorId || !/^\d+$/.test(creatorId)) throw new Error("ROBLOX_CREATOR_ID must be numeric.");
if (creatorType !== "userId" && creatorType !== "groupId") {
	throw new Error("ROBLOX_CREATOR_TYPE must be userId or groupId.");
}

const hierarchy = {
	HumanoidRootPart: {
		LowerTorso: {
			UpperTorso: {
				Head: {},
				LeftUpperArm: { LeftLowerArm: { LeftHand: {} } },
				RightUpperArm: { RightLowerArm: { RightHand: {} } },
			},
			LeftUpperLeg: { LeftLowerLeg: { LeftFoot: {} } },
			RightUpperLeg: { RightLowerLeg: { RightFoot: {} } },
		},
	},
};
const gameEngineHierarchy = {
	Root: {
		pelvis: {
			spine_01: {
				spine_02: {
					spine_03: {
						clavicle_l: { upperarm_l: { lowerarm_l: { hand_l: {} } } },
						clavicle_r: { upperarm_r: { lowerarm_r: { hand_r: {} } } },
						neck_01: { head: {} },
					},
				},
			},
			thigh_l: { calf_l: { foot_l: {} } },
			thigh_r: { calf_r: { foot_r: {} } },
		},
	},
};

const identity = [0, 0, 0];
const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
const clean = (value) => (Math.abs(value) < 1e-9 ? 0 : value);

function matrix([x, y, z]) {
	const cx = Math.cos(x),
		sx = Math.sin(x),
		cy = Math.cos(y),
		sy = Math.sin(y),
		cz = Math.cos(z),
		sz = Math.sin(z);
	return [
		clean(cy * cz),
		clean(cz * sx * sy - cx * sz),
		clean(sx * sz + cx * cz * sy),
		clean(cy * sz),
		clean(cx * cz + sx * sy * sz),
		clean(cx * sy * sz - cz * sx),
		clean(-sy),
		clean(cy * sx),
		clean(cx * cy),
	];
}

function coordinateFrame(rotation) {
	const r = matrix(rotation);
	return `<CoordinateFrame name="CFrame"><X>0</X><Y>0</Y><Z>0</Z><R00>${r[0]}</R00><R01>${r[1]}</R01><R02>${r[2]}</R02><R10>${r[3]}</R10><R11>${r[4]}</R11><R12>${r[5]}</R12><R20>${r[6]}</R20><R21>${r[7]}</R21><R22>${r[8]}</R22></CoordinateFrame>`;
}

function poseXml(name, children, rotations, indent) {
	const rotation = rotations[name] ?? identity;
	const nested = Object.entries(children)
		.map(([childName, descendants]) => poseXml(childName, descendants, rotations, `${indent}\t`))
		.join("");
	return `${indent}<Item class="Pose"><Properties>${coordinateFrame(rotation)}<token name="EasingDirection">0</token><token name="EasingStyle">0</token><string name="Name">${name}</string><float name="Weight">1</float></Properties>${nested}${indent}</Item>`;
}

function sequenceXml(clip) {
	const keyframes = clip.frames
		.map(({ time, rotations }, index) => {
			const poses = Object.entries(clip.hierarchy ?? hierarchy)
				.map(([name, children]) => poseXml(name, children, rotations, "\t\t"))
				.join("");
			return `\t<Item class="Keyframe"><Properties><string name="Name">Keyframe${index + 1}</string><float name="Time">${time}</float></Properties>${poses}\t</Item>`;
		})
		.join("");
	return `<roblox version="4"><Item class="KeyframeSequence"><Properties><bool name="Loop">${clip.loop}</bool><string name="Name">${clip.name}</string><token name="Priority">${clip.priority}</token></Properties>${keyframes}</Item></roblox>`;
}

const clips = [
	{
		name: "BanditIdle",
		loop: true,
		priority: 0,
		frames: [0, 0.5, 1, 1.5, 2].map((time) => ({
			time,
			rotations: {
				UpperTorso: [Math.sin(time * Math.PI) * 0.045, 0, 0],
				LeftUpperArm: [0.08, 0, -0.1],
				RightUpperArm: [0.08, 0, 0.1],
				Head: [-Math.sin(time * Math.PI) * 0.02, 0, 0],
			},
		})),
	},
	{
		name: "BanditRun",
		loop: true,
		priority: 1,
		frames: [0, 0.25, 0.5, 0.75, 1].map((time) => {
			const stride = Math.sin(time * Math.PI * 2);
			return {
				time,
				rotations: {
					UpperTorso: [0.14, 0, Math.sin(time * Math.PI * 4) * 0.035],
					LeftUpperArm: [stride * 0.8, 0, -0.08],
					RightUpperArm: [-stride * 0.8, 0, 0.08],
					LeftUpperLeg: [-stride * 0.72, 0, 0],
					RightUpperLeg: [stride * 0.72, 0, 0],
					LeftLowerLeg: [Math.max(0, stride) * 0.5, 0, 0],
					RightLowerLeg: [Math.max(0, -stride) * 0.5, 0, 0],
				},
			};
		}),
	},
	{
		name: "BanditAttack",
		loop: false,
		priority: 2,
		frames: [
			{ time: 0, rotations: {} },
			{
				time: 0.22,
				rotations: {
					UpperTorso: [0.08, 0.48, 0],
					RightUpperArm: [-1.5, 0.25, 0.55],
					RightLowerArm: [-0.45, 0, 0],
					LeftUpperArm: [-0.35, -0.15, -0.25],
				},
			},
			{
				time: 0.42,
				rotations: {
					UpperTorso: [0.12, -0.48, 0],
					RightUpperArm: [0.65, 0.15, 0.2],
					RightLowerArm: [-0.15, 0, 0],
					LeftUpperArm: [-0.1, 0.1, -0.15],
				},
			},
			{ time: 0.72, rotations: {} },
		],
	},
	{
		name: "RealisticPirateIdle",
		loop: true,
		priority: 0,
		hierarchy: gameEngineHierarchy,
		frames: [0, 1, 2].map((time) => ({
			time,
			rotations: {
				spine_02: [Math.sin(time * Math.PI) * 0.035, 0, 0],
				upperarm_l: [0.06, 0, -0.08],
				upperarm_r: [0.06, 0, 0.08],
			},
		})),
	},
	{
		name: "RealisticPirateRun",
		loop: true,
		priority: 1,
		hierarchy: gameEngineHierarchy,
		frames: [0, 0.25, 0.5, 0.75, 1].map((time) => {
			const stride = Math.sin(time * Math.PI * 2);
			return {
				time,
				rotations: {
					spine_02: [0.09, 0, 0],
					thigh_l: [-stride * 0.65, 0, 0],
					thigh_r: [stride * 0.65, 0, 0],
					calf_l: [Math.max(0, stride) * 0.5, 0, 0],
					calf_r: [Math.max(0, -stride) * 0.5, 0, 0],
					upperarm_l: [stride * 0.55, 0, 0],
					upperarm_r: [-stride * 0.55, 0, 0],
				},
			};
		}),
	},
	{
		name: "RealisticPirateSwordAttack",
		loop: false,
		priority: 2,
		hierarchy: gameEngineHierarchy,
		frames: [
			{ time: 0, rotations: {} },
			{
				time: 0.24,
				rotations: { spine_02: [0.05, 0.45, 0], upperarm_r: [-1.3, 0.25, 0.45], lowerarm_r: [-0.5, 0, 0] },
			},
			{
				time: 0.46,
				rotations: { spine_02: [0.12, -0.5, 0], upperarm_r: [0.75, 0.1, 0.15], lowerarm_r: [-0.1, 0, 0] },
			},
			{ time: 0.8, rotations: {} },
		],
	},
	{
		name: "RealisticPirateCrossbowFire",
		loop: false,
		priority: 2,
		hierarchy: gameEngineHierarchy,
		frames: [
			{ time: 0, rotations: {} },
			{
				time: 0.25,
				rotations: {
					upperarm_l: [-0.9, -0.15, -0.35],
					lowerarm_l: [-1.05, 0, 0],
					upperarm_r: [-0.85, 0.2, 0.3],
					lowerarm_r: [-1, 0, 0],
				},
			},
			{
				time: 0.45,
				rotations: { spine_02: [-0.05, 0, 0], upperarm_l: [-0.95, -0.15, -0.35], upperarm_r: [-0.9, 0.2, 0.3] },
			},
			{ time: 0.9, rotations: {} },
		],
	},
];

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
		description: "Sicilian bandit R15 animation for the Greek Odyssey RPG.",
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
		await wait(2000);
		operation = await requestJson(`https://apis.roblox.com/assets/v1/operations/${operationId}`, {
			headers: { "x-api-key": apiKey },
		});
	}
	if (!operation.done || operation.error)
		throw new Error(`Upload for ${name} failed: ${JSON.stringify(operation.error)}`);
	if (!operation.response?.assetId) throw new Error(`Upload for ${name} returned no asset ID.`);
	return String(operation.response.assetId);
}

await mkdir(outputRoot, { recursive: true });
let manifest = { creatorId, creatorType, assets: {} };
try {
	manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
	if (error.code !== "ENOENT") throw error;
}
if (manifest.creatorId !== creatorId || manifest.creatorType !== creatorType)
	throw new Error("Animation manifest creator mismatch.");
for (const clip of clips) {
	const path = resolve(outputRoot, `${clip.name}.rbxmx`);
	const xml = sequenceXml(clip);
	await writeFile(path, xml);
	const hash = createHash("sha256").update(xml).digest("hex");
	if (manifest.assets[clip.name]?.contentHash === hash) continue;
	const assetId = await upload(clip.name, await readFile(path));
	manifest.assets[clip.name] = { assetId, contentHash: hash, source: `roblox/${clip.name}.rbxmx` };
	const temporary = `${manifestPath}.tmp`;
	await writeFile(temporary, `${JSON.stringify(manifest, undefined, "\t")}\n`, { mode: 0o600 });
	await rename(temporary, manifestPath);
	process.stdout.write(`Uploaded ${clip.name} as ${assetId}\n`);
}
