import { describe, expect, it } from "vitest";
import { createTokenBucket } from "./token-bucket.js";

function fakeTime() {
	let current = 10_000;
	const sleeps: number[] = [];
	return {
		now: () => current,
		advance(ms: number) {
			current += ms;
		},
		sleeps,
		async sleep(ms: number) {
			sleeps.push(ms);
			current += ms;
		},
	};
}

describe("createTokenBucket", () => {
	it("lets the first take through and spaces the next ones by 1000 / rate ms", async () => {
		const time = fakeTime();
		const take = createTokenBucket({ ratePerSecond: 5, ...time });
		const takenAt: number[] = [];

		for (let i = 0; i < 6; i++) {
			await take();
			takenAt.push(time.now());
		}

		expect(takenAt).toEqual([10_000, 10_200, 10_400, 10_600, 10_800, 11_000]);
		expect(time.sleeps).toEqual([200, 200, 200, 200, 200]);
	});

	it("never allows more than the rate within any one-second window", async () => {
		const time = fakeTime();
		const take = createTokenBucket({ ratePerSecond: 5, ...time });
		const takenAt: number[] = [];

		for (let i = 0; i < 20; i++) {
			await take();
			takenAt.push(time.now());
			time.advance(i % 3 === 0 ? 0 : 37);
		}

		for (const start of takenAt) {
			const inWindow = takenAt.filter((t) => t >= start && t < start + 1000);
			expect(inWindow.length).toBeLessThanOrEqual(5);
		}
	});

	it("does not wait when the caller is already slower than the rate", async () => {
		const time = fakeTime();
		const take = createTokenBucket({ ratePerSecond: 5, ...time });

		await take();
		time.advance(500);
		await take();
		time.advance(200);
		await take();

		expect(time.sleeps).toEqual([]);
	});

	it("waits only for the remainder of the interval", async () => {
		const time = fakeTime();
		const take = createTokenBucket({ ratePerSecond: 5, ...time });

		await take();
		time.advance(150);
		await take();

		expect(time.sleeps).toEqual([50]);
	});
});
