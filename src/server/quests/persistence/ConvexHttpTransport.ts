import { HttpService } from "@rbxts/services";

export type ConvexHttpResult =
	| { readonly ok: true; readonly statusCode: number; readonly body: unknown }
	| { readonly ok: false; readonly error: string; readonly retryable: boolean };

export interface ConvexHttpTransport {
	post(path: string, body: Readonly<Record<string, unknown>>): ConvexHttpResult;
}

function formatError(value: unknown): string {
	return typeIs(value, "string") ? value : "Unknown HTTP request error";
}

export class RobloxConvexHttpTransport implements ConvexHttpTransport {
	private readonly baseUrl: string;

	public constructor(
		baseUrl: string,
		private readonly authorization: Secret,
	) {
		this.baseUrl = baseUrl.sub(-1) === "/" ? baseUrl.sub(1, -2) : baseUrl;
		assert(
			this.baseUrl.match("^https://[%w%-]+%.convex%.site$")[0] !== undefined ||
				(this.baseUrl.match("^http://127%.0%.0%.1:%d+$")[0] !== undefined && game.GameId === 0),
			"ConvexSiteUrl must be an HTTPS .convex.site URL (or localhost in an unpublished place).",
		);
	}

	public post(path: string, body: Readonly<Record<string, unknown>>): ConvexHttpResult {
		if (path.sub(1, 1) !== "/") {
			return { ok: false, error: "Convex request paths must begin with '/'.", retryable: false };
		}

		const [requestOk, response] = pcall(() =>
			HttpService.RequestAsync({
				Url: `${this.baseUrl}${path}`,
				Method: "POST",
				Headers: {
					["Content-Type"]: "application/json",
					Authorization: this.authorization,
				},
				Body: HttpService.JSONEncode(body),
			}),
		);
		if (!requestOk) return { ok: false, error: formatError(response), retryable: true };

		if (response.Body.size() === 0) return { ok: true, statusCode: response.StatusCode, body: undefined };
		const [decodeOk, decoded] = pcall(() => HttpService.JSONDecode(response.Body));
		return {
			ok: true,
			statusCode: response.StatusCode,
			body: decodeOk ? decoded : response.Body,
		};
	}
}
