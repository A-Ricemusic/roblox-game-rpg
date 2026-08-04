import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "../src/world/starting-area/starting-area.project.json");

const COLORS = {
	agedMarble: [0.78, 0.74, 0.65],
	bronze: [0.47, 0.29, 0.12],
	cliff: [0.24, 0.22, 0.19],
	darkOlive: [0.16, 0.31, 0.11],
	grass: [0.27, 0.39, 0.17],
	limestone: [0.82, 0.75, 0.61],
	marble: [0.91, 0.88, 0.79],
	olive: [0.27, 0.48, 0.14],
	terracotta: [0.5, 0.2, 0.1],
	trunk: [0.28, 0.17, 0.08],
	water: [0.08, 0.42, 0.58],
};

const folder = (children = {}) => ({ $className: "Folder", $ignoreUnknownInstances: false, ...children });
const add = (target, value) => Object.assign(target, value);

function part(name, size, position, options = {}) {
	const properties = {
		Anchored: true,
		CanCollide: options.canCollide ?? true,
		CanQuery: options.canQuery ?? true,
		CanTouch: false,
		Color: options.color ?? COLORS.limestone,
		Material: options.material ?? "Sandstone",
		Position: position,
		Size: size,
		Locked: true,
	};
	if (options.orientation !== undefined) properties.Orientation = options.orientation;
	if (options.shape !== undefined) properties.Shape = options.shape;
	if (options.transparency !== undefined) properties.Transparency = options.transparency;
	return { [name]: { $className: options.className ?? "Part", $properties: properties } };
}

function addColumn(target, prefix, x, groundY, z, height = 11) {
	add(target, part(`${prefix}Base`, [4.2, 0.8, 4.2], [x, groundY + 0.4, z], { material: "Marble" }));
	add(
		target,
		part(`${prefix}Shaft`, [height, 2.4, 2.4], [x, groundY + 0.8 + height / 2, z], {
			color: COLORS.marble,
			material: "Marble",
			orientation: [0, 0, 90],
			shape: "Cylinder",
		}),
	);
	add(
		target,
		part(`${prefix}CapitalLower`, [3.4, 0.55, 3.4], [x, groundY + height + 1.08, z], { material: "Marble" }),
	);
	add(
		target,
		part(`${prefix}CapitalUpper`, [4.2, 0.55, 4.2], [x, groundY + height + 1.63, z], { material: "Marble" }),
	);
}

function addOliveTree(target, prefix, x, z, scale = 1) {
	add(
		target,
		part(`${prefix}Trunk`, [2 * scale, 6 * scale, 2 * scale], [x, 3 * scale, z], {
			color: COLORS.trunk,
			material: "Wood",
		}),
	);
	const canopy = [
		[-1.8, 7.1, 0, 5.4],
		[1.8, 7.4, 0.5, 5],
		[0, 8.2, -1.7, 5.2],
		[0.3, 7.8, 2, 4.6],
	];
	for (let index = 0; index < canopy.length; index += 1) {
		const [offsetX, y, offsetZ, diameter] = canopy[index];
		add(
			target,
			part(
				`${prefix}Canopy${index + 1}`,
				[diameter * scale, diameter * scale, diameter * scale],
				[x + offsetX * scale, y * scale, z + offsetZ * scale],
				{
					canCollide: false,
					canQuery: false,
					color: index % 2 === 0 ? COLORS.olive : COLORS.darkOlive,
					material: "Grass",
					shape: "Ball",
				},
			),
		);
	}
}

function addBrazier(target, prefix, x, y, z) {
	add(target, part(`${prefix}Stand`, [0.8, 3.2, 0.8], [x, y + 1.6, z], { color: COLORS.bronze, material: "Metal" }));
	add(
		target,
		part(`${prefix}Bowl`, [0.7, 3.1, 3.1], [x, y + 3.3, z], {
			color: COLORS.bronze,
			material: "Metal",
			orientation: [0, 0, 90],
			shape: "Cylinder",
		}),
	);
	const bowl = target[`${prefix}Bowl`];
	bowl.Flame = {
		$className: "Fire",
		$properties: { Color: [1, 0.58, 0.12], Heat: 5, SecondaryColor: [0.82, 0.18, 0.04], Size: 4 },
	};
	bowl.Glow = {
		$className: "PointLight",
		$properties: { Brightness: 1.5, Color: [1, 0.57, 0.2], Range: 18, Shadows: true },
	};
}

const ground = {};
add(ground, part("IslandGround", [160, 2, 180], [0, -1, -15], { color: COLORS.grass, material: "Grass" }));
add(
	ground,
	part("Ocean", [512, 0.2, 512], [0, -1.7, 0], {
		canCollide: false,
		canQuery: false,
		color: COLORS.water,
		material: "Glass",
		transparency: 0.25,
	}),
);
add(ground, part("ArrivalCourt", [52, 0.6, 36], [0, 0.3, 42], { material: "Sandstone" }));
add(ground, part("AgoraCourt", [50, 0.5, 38], [0, 0.25, 8], { color: COLORS.agedMarble, material: "Cobblestone" }));
add(ground, part("GroveGround", [54, 0.35, 34], [0, 0.17, -13], { color: [0.22, 0.36, 0.13], material: "Grass" }));
add(ground, part("ProcessionalWay", [18, 0.45, 94], [0, 0.25, -9], { material: "Sandstone" }));
for (let index = 0; index < 12; index += 1) {
	add(
		ground,
		part(`ProcessionalSlab${index + 1}`, [14.5, 0.18, 4.8], [0, 0.55, 34 - index * 7], {
			canCollide: false,
			canQuery: false,
			color: index % 2 === 0 ? COLORS.marble : COLORS.agedMarble,
			material: "Marble",
		}),
	);
}

const arrival = {};
arrival.SpawnMosaic = {
	$className: "SpawnLocation",
	$properties: {
		Anchored: true,
		CanCollide: false,
		CanTouch: false,
		Color: [0.12, 0.32, 0.47],
		Duration: 0,
		Enabled: true,
		Locked: true,
		Material: "Marble",
		Neutral: true,
		Position: [0, 0.65, 47],
		Size: [8, 0.3, 8],
		Transparency: 0.05,
	},
};
add(arrival, part("SeaWall", [52, 3, 2], [0, 1.5, 59]));
add(arrival, part("SeaWallCapLeft", [17, 2, 2], [-17.5, 3.7, 59], { material: "Marble" }));
add(arrival, part("SeaWallCapRight", [17, 2, 2], [17.5, 3.7, 59], { material: "Marble" }));
addColumn(arrival, "GatewayLeft", -12, 0.6, 30, 10);
addColumn(arrival, "GatewayRight", 12, 0.6, 30, 10);
add(arrival, part("GatewayLintel", [30, 2.2, 4], [0, 12.8, 30], { material: "Marble" }));
add(arrival, part("GatewayFrieze", [25, 1.1, 4.4], [0, 14.45, 30], { color: COLORS.terracotta, material: "Brick" }));
addBrazier(arrival, "ArrivalBrazierLeft", -19, 0.6, 49);
addBrazier(arrival, "ArrivalBrazierRight", 19, 0.6, 49);

const shrine = {};
add(
	shrine,
	part("FountainBasin", [1.2, 15, 15], [-18, 0.8, 20], {
		material: "Marble",
		orientation: [0, 0, 90],
		shape: "Cylinder",
	}),
);
add(
	shrine,
	part("FountainWater", [0.35, 12, 12], [-18, 1.45, 20], {
		canCollide: false,
		canQuery: false,
		color: [0.12, 0.55, 0.72],
		material: "Glass",
		orientation: [0, 0, 90],
		shape: "Cylinder",
		transparency: 0.2,
	}),
);
add(shrine, part("OfferingPlinth", [4, 2, 4], [-10, 1.6, 20], { material: "Marble" }));
add(
	shrine,
	part("OfferingDish", [0.55, 4.8, 4.8], [-10, 2.9, 20], {
		color: COLORS.bronze,
		material: "Metal",
		orientation: [0, 0, 90],
		shape: "Cylinder",
	}),
);
for (const [name, x, z] of [
	["NorthWest", -25, 13],
	["NorthEast", -11, 13],
	["SouthWest", -25, 27],
	["SouthEast", -11, 27],
]) {
	add(shrine, part(`FountainPost${name}`, [1.3, 3, 1.3], [x, 1.5, z], { material: "Marble" }));
}

const agora = {};
add(agora, part("WestStoaWall", [3, 8, 30], [-27, 4, 7], { color: COLORS.agedMarble }));
add(agora, part("EastStoaWall", [3, 8, 30], [27, 4, 7], { color: COLORS.agedMarble }));
for (const [side, x] of [
	["West", -23],
	["East", 23],
]) {
	for (let index = 0; index < 3; index += 1) addColumn(agora, `${side}Stoa${index + 1}`, x, 0.5, -2 + index * 9, 7);
}
add(
	agora,
	part("FallenColumnWest", [9, 2.2, 2.2], [-12, 1.4, 6], {
		color: COLORS.agedMarble,
		material: "Marble",
		shape: "Cylinder",
	}),
);
add(agora, part("FallenCapitalWest", [3.5, 2, 3.5], [-17, 1, 5], { material: "Marble", orientation: [12, 20, 8] }));
add(
	agora,
	part("FallenColumnEast", [8, 2, 2], [18, 1.2, 12], {
		color: COLORS.agedMarble,
		material: "Marble",
		shape: "Cylinder",
	}),
);
add(
	agora,
	part("FallenCapitalEast", [3.2, 1.8, 3.2], [22.5, 0.9, 11], { material: "Marble", orientation: [-8, -18, 5] }),
);

const grove = {};
addOliveTree(grove, "OliveWest", -19, -10, 1.05);
addOliveTree(grove, "OliveNorthWest", -7, -21, 0.95);
addOliveTree(grove, "OliveNorthEast", 7, -21, 1);
addOliveTree(grove, "OliveEast", 19, -10, 1.05);
for (const [name, x, z] of [
	["West", -14, -10],
	["Center", 0, -16],
	["East", 14, -10],
]) {
	add(
		grove,
		part(`BranchMarker${name}`, [3.6, 0.25, 3.6], [x, 0.35, z], {
			canCollide: false,
			canQuery: false,
			color: COLORS.marble,
			material: "Marble",
			shape: "Ball",
		}),
	);
}
add(grove, part("GroveSeatWest", [8, 1.2, 2], [-24, 0.8, -20], { material: "Marble" }));
add(grove, part("GroveSeatEast", [8, 1.2, 2], [24, 0.8, -20], { material: "Marble" }));
addBrazier(grove, "GroveBrazierLeft", -22, 0.4, -28);
addBrazier(grove, "GroveBrazierRight", 22, 0.4, -28);

const temple = {};
for (let index = 0; index < 12; index += 1) {
	const height = (index + 1) * 0.5;
	add(
		temple,
		part(`TempleStep${index + 1}`, [34, height, 2.2], [0, height / 2, -23 - index * 2], {
			color: index % 2 === 0 ? COLORS.limestone : COLORS.agedMarble,
			material: "Marble",
		}),
	);
}
add(
	temple,
	part("TempleAccessRamp", [7, 0.6, 26], [0, 3, -34], {
		canQuery: false,
		material: "SmoothPlastic",
		orientation: [13, 0, 0],
		transparency: 1,
	}),
);
add(temple, part("TempleTerrace", [58, 6, 48], [0, 3, -70], { color: COLORS.agedMarble }));
add(temple, part("TempleFloor", [42, 0.8, 34], [0, 6.4, -69], { material: "Marble" }));
for (const [index, x] of [-15, -9, -3, 3, 9, 15].entries())
	addColumn(temple, `FrontColumn${index + 1}`, x, 6.8, -50.5, 10.5);
for (const [side, x] of [
	["West", -17],
	["East", 17],
]) {
	for (let index = 0; index < 3; index += 1)
		addColumn(temple, `${side}Column${index + 1}`, x, 6.8, -60 - index * 9, 10.5);
}
add(temple, part("RearWall", [36, 12, 2], [0, 13, -85], { material: "Marble" }));
add(temple, part("WestCellaWall", [2, 11, 24], [-12, 12.5, -72], { material: "Marble" }));
add(temple, part("EastCellaWall", [2, 11, 24], [12, 12.5, -72], { material: "Marble" }));
add(temple, part("FrontLintel", [42, 2, 4], [0, 19.2, -50.5], { material: "Marble" }));
add(temple, part("WestLintel", [4, 2, 38], [-17, 19.2, -68], { material: "Marble" }));
add(temple, part("EastLintel", [4, 2, 38], [17, 19.2, -68], { material: "Marble" }));
add(
	temple,
	part("RoofSouth", [44, 1.2, 19], [0, 21.5, -59.8], {
		color: COLORS.terracotta,
		material: "Brick",
		orientation: [-15, 0, 0],
	}),
);
add(
	temple,
	part("RoofNorth", [44, 1.2, 19], [0, 21.5, -76.2], {
		color: COLORS.terracotta,
		material: "Brick",
		orientation: [15, 0, 0],
	}),
);
add(temple, part("AthenaPlinth", [7, 3, 7], [0, 8.3, -78], { material: "Marble" }));
add(temple, part("AthenaFigure", [3.5, 9, 3.5], [0, 14.2, -78], { material: "Marble" }));
add(temple, part("AthenaHelm", [4.5, 2, 4.5], [0, 19.3, -78], { color: COLORS.bronze, material: "Metal" }));
add(temple, part("AthenaSpear", [0.45, 13, 0.45], [3, 14.5, -78], { color: COLORS.bronze, material: "Metal" }));
addBrazier(temple, "TempleBrazierLeft", -8, 6.8, -76);
addBrazier(temple, "TempleBrazierRight", 8, 6.8, -76);

const boundaries = {};
for (const [side, x] of [
	["West", -78],
	["East", 78],
]) {
	for (let index = 0; index < 9; index += 1) {
		const z = 56 - index * 18;
		const height = 9 + (index % 3) * 3;
		add(
			boundaries,
			part(`${side}Cliff${index + 1}`, [9 + (index % 2) * 4, height, 20], [x, height / 2 - 0.5, z], {
				color: COLORS.cliff,
				material: "Rock",
				orientation: [0, index % 2 === 0 ? 8 : -8, index % 3 === 0 ? 4 : -3],
			}),
		);
	}
}
for (let index = 0; index < 8; index += 1) {
	add(
		boundaries,
		part(`NorthCliff${index + 1}`, [21, 13 + (index % 2) * 4, 10], [-66 + index * 19, 6, -103], {
			color: COLORS.cliff,
			material: "Rock",
			orientation: [0, index % 2 === 0 ? 5 : -5, 0],
		}),
	);
}
add(boundaries, part("WestFutureGate", [4, 14, 18], [-70, 7, 3], { color: COLORS.agedMarble, material: "Marble" }));
add(boundaries, part("EastFutureGate", [4, 14, 18], [70, 7, 3], { color: COLORS.agedMarble, material: "Marble" }));

const project = {
	name: "GreekStartingArea",
	tree: {
		$className: "Model",
		$ignoreUnknownInstances: false,
		Ground: folder(ground),
		ArrivalCourt: folder(arrival),
		OfferingShrine: folder(shrine),
		AgoraRuins: folder(agora),
		SacredGrove: folder(grove),
		TempleOfAthena: folder(temple),
		Boundaries: folder(boundaries),
	},
};

mkdirSync(dirname(outputPath), { recursive: true });
const formattedProject = await format(JSON.stringify(project), {
	parser: "json",
	printWidth: 120,
	tabWidth: 4,
	trailingComma: "all",
	useTabs: true,
});
if (process.argv.includes("--check")) {
	const existingProject = readFileSync(outputPath, "utf8");
	if (existingProject !== formattedProject)
		throw new Error("Greek starting-area output is stale. Run npm run world:generate.");
	console.log(`Verified ${outputPath}`);
} else {
	writeFileSync(outputPath, formattedProject, "utf8");
	console.log(`Generated ${outputPath}`);
}
